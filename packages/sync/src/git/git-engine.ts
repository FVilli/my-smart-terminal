import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatIsoWithOffset } from '@smart-terminal/data';
import type { SyncState, SyncStatus } from '../protocol';

export interface GitEngineOptions {
  /** Radice del repo dati (contiene `sessions/`). */
  repoPath: string;
  machine: string;
  /** Remote `origin` opzionale (`SMART_TERMINAL_GIT_REMOTE`). */
  remote?: string;
  /** Default `main` (`SMART_TERMINAL_GIT_BRANCH`). */
  branch?: string;
  clock?: () => Date;
  gitBinary?: string;
  commandTimeoutMs?: number;
  /** Tentativi totali di fetch/rebase/push quando il push e' rifiutato (default 4). */
  maxPushAttempts?: number;
  /** Backoff base tra i tentativi, raddoppia a ogni retry (default 250 ms). */
  backoffMs?: number;
  /** Osserva ogni invocazione git (argomenti inclusi); usato dai test per vietare `--force`. */
  onCommand?: (args: readonly string[]) => void;
  onStatusChange?: (status: SyncStatus) => void;
}

export interface GitResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export class GitEngineError extends Error {
  constructor(
    readonly kind: 'offline' | 'conflict' | 'git',
    message: string,
  ) {
    super(message);
    this.name = 'GitEngineError';
  }
}

const MAX_BUFFER = 8 * 1024 * 1024;
const SYNC_DIRECTORY = 'sessions';
const OFFLINE_PATTERN =
  /could not resolve host|unable to access|network is unreachable|connection (refused|timed out|reset|closed)|operation timed out|could not read from remote|does not appear to be a git repository|unable to connect|temporary failure in name resolution|no route to host|ssh: connect/i;
const REJECTED_PATTERN = /non-fast-forward|\[rejected\]|fetch first|failed to push some refs|stale info/i;
const GITIGNORE = ['# Smart Terminal: file temporanei', '*.tmp', '*.lock', '.*.swp', '.DS_Store', ''].join('\n');

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Motore Git seriale basato sul CLI `git` (execFile, mai shell). Stage solo `sessions/`, mai force push.
 * Tutte le operazioni mutanti passano da un mutex in-process: un solo scrittore Git per istanza.
 */
export class GitEngine {
  private readonly branch: string;
  private readonly clock: () => Date;
  private readonly gitBinary: string;
  private readonly timeoutMs: number;
  private readonly maxPushAttempts: number;
  private readonly backoffMs: number;
  private chain: Promise<unknown> = Promise.resolve();
  private current: SyncStatus = { state: 'synced' };
  private dirtyDuringSync = false;
  private initialised = false;

  constructor(private readonly options: GitEngineOptions) {
    this.branch = options.branch ?? 'main';
    this.clock = options.clock ?? (() => new Date());
    this.gitBinary = options.gitBinary ?? 'git';
    this.timeoutMs = options.commandTimeoutMs ?? 60_000;
    this.maxPushAttempts = options.maxPushAttempts ?? 4;
    this.backoffMs = options.backoffMs ?? 250;
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(this.branch) || this.branch.includes('..')) {
      throw new GitEngineError('git', 'Invalid git branch name');
    }
  }

  get status(): SyncStatus {
    return { ...this.current };
  }

  /** Segnala modifiche locali non ancora sincronizzate. Non cambia uno stato `syncing` (viene ricordato). */
  markDirty(): void {
    if (this.current.state === 'syncing') {
      this.dirtyDuringSync = true;
      return;
    }
    this.setStatus({ ...this.current, state: 'dirty' });
  }

  initIfNeeded(): Promise<void> {
    return this.serialize(() => this.initLocked());
  }

  /** Commit locale di `sessions/` + fetch/rebase/push. Non lancia: l'esito e' nello stato restituito. */
  syncOnce(): Promise<SyncStatus> {
    return this.serialize(async () => {
      this.dirtyDuringSync = false;
      this.setStatus({ ...this.current, state: 'syncing' });
      try {
        if (!this.initialised) {
          await this.initLocked();
        }
        await this.syncLocked();
        this.finish('synced');
      } catch (error) {
        if (error instanceof GitEngineError && error.kind === 'offline') {
          this.finish('offline', error.message);
        } else {
          this.finish('error', error instanceof GitEngineError ? error.message : 'Unexpected git error');
        }
      }
      return this.status;
    });
  }

  private finish(state: SyncState, error?: string): void {
    const lastSyncAt = state === 'synced' ? this.clock().toISOString() : this.current.lastSyncAt;
    const next: SyncStatus = { state: state === 'synced' && this.dirtyDuringSync ? 'dirty' : state };
    if (lastSyncAt !== undefined) next.lastSyncAt = lastSyncAt;
    if (error !== undefined) next.lastError = error;
    this.dirtyDuringSync = false;
    this.setStatus(next);
  }

  private setStatus(status: SyncStatus): void {
    this.current = status;
    this.options.onStatusChange?.(this.status);
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(task, task);
    this.chain = run.catch(() => undefined);
    return run;
  }

  // ---- git plumbing ----

  private run(args: readonly string[]): Promise<GitResult> {
    this.options.onCommand?.(args);
    return new Promise((resolve) => {
      execFile(
        this.gitBinary,
        [...args],
        {
          cwd: this.options.repoPath,
          timeout: this.timeoutMs,
          maxBuffer: MAX_BUFFER,
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', LANG: 'C', GIT_OPTIONAL_LOCKS: '0' },
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          const failure = error as (NodeJS.ErrnoException & { killed?: boolean }) | null;
          resolve({
            code: failure === null ? 0 : typeof failure.code === 'number' ? failure.code : null,
            stdout: String(stdout),
            stderr: failure !== null && typeof failure.code === 'string' ? `${failure.code}: ${String(stderr)}` : String(stderr),
            timedOut: failure?.killed === true,
          });
        },
      );
    });
  }

  private async git(args: readonly string[]): Promise<GitResult> {
    const result = await this.run(args);
    if (result.code !== 0) {
      throw this.classify(result);
    }
    return result;
  }

  private classify(result: GitResult): GitEngineError {
    if (result.timedOut || OFFLINE_PATTERN.test(result.stderr)) {
      return new GitEngineError('offline', 'Remote unreachable');
    }
    return new GitEngineError('git', this.sanitize(result.stderr));
  }

  /** Una riga, senza percorsi locali ne' credenziali nelle URL. */
  private sanitize(text: string): string {
    const line = text.split('\n').find((l) => l.trim().length > 0) ?? 'git command failed';
    return line
      .replaceAll(this.options.repoPath, '<repo>')
      .replaceAll(os.homedir(), '~')
      .replace(/:\/\/[^/@\s]+@/g, '://***@')
      .slice(0, 200);
  }

  // ---- init ----

  private async initLocked(): Promise<void> {
    const { repoPath } = this.options;
    fs.mkdirSync(path.join(repoPath, SYNC_DIRECTORY), { recursive: true });
    if (!fs.existsSync(path.join(repoPath, '.git'))) {
      await this.git(['init', '-b', this.branch]);
    }
    await this.setLocalConfigIfMissing('user.name', `Smart Terminal (${this.options.machine})`);
    await this.setLocalConfigIfMissing('user.email', `smart-terminal@${this.options.machine}.invalid`);
    await this.git(['config', '--local', 'commit.gpgsign', 'false']);
    const ignore = path.join(repoPath, '.gitignore');
    if (!fs.existsSync(ignore)) {
      fs.writeFileSync(ignore, GITIGNORE, 'utf8');
    }
    if (this.options.remote !== undefined && this.options.remote.length > 0) {
      await this.configureRemote(this.options.remote);
    }
    this.initialised = true;
  }

  private async setLocalConfigIfMissing(key: string, value: string): Promise<void> {
    const existing = await this.run(['config', '--local', '--get', key]);
    if (existing.code !== 0 || existing.stdout.trim().length === 0) {
      await this.git(['config', '--local', key, value]);
    }
  }

  /** init+remote deterministico: se il repo e' senza commit e il remote ha il branch, lo adotta senza sovrascrivere file locali. */
  private async configureRemote(remote: string): Promise<void> {
    const current = await this.run(['remote', 'get-url', 'origin']);
    if (current.code !== 0) {
      await this.git(['remote', 'add', 'origin', remote]);
    } else if (current.stdout.trim() !== remote) {
      await this.git(['remote', 'set-url', 'origin', remote]);
    }
    const hasCommits = (await this.run(['rev-parse', '--verify', '--quiet', 'HEAD'])).code === 0;
    if (hasCommits) {
      return;
    }
    try {
      await this.git(['fetch', 'origin']);
    } catch (error) {
      if (error instanceof GitEngineError && error.kind === 'offline') {
        return; // il primo sync adotterà il remote quando raggiungibile
      }
      throw error;
    }
    if (await this.remoteBranchExists()) {
      await this.git(['checkout', '-B', this.branch, `origin/${this.branch}`]);
    }
  }

  private async remoteBranchExists(): Promise<boolean> {
    return (await this.run(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${this.branch}`])).code === 0;
  }

  // ---- sync ----

  private async syncLocked(): Promise<void> {
    await this.commitSessions();
    if (this.options.remote === undefined || this.options.remote.length === 0) {
      return;
    }
    for (let attempt = 1; ; attempt += 1) {
      await this.git(['fetch', 'origin']);
      await this.rebaseOntoRemote();
      if (await this.push()) {
        return;
      }
      if (attempt >= this.maxPushAttempts) {
        throw new GitEngineError('git', 'Push rejected after retries');
      }
      await sleep(this.backoffMs * 2 ** (attempt - 1));
    }
  }

  private async commitSessions(): Promise<void> {
    await this.git(['add', '--', SYNC_DIRECTORY]);
    const staged = await this.git(['diff', '--cached', '--name-only', '--', SYNC_DIRECTORY]);
    if (staged.stdout.trim().length === 0) {
      return;
    }
    const message = `sessions: ${this.options.machine} ${formatIsoWithOffset(this.clock())}`;
    await this.git(['commit', '--no-verify', '-m', message, '--', SYNC_DIRECTORY]);
  }

  private async rebaseOntoRemote(): Promise<void> {
    if (!(await this.remoteBranchExists())) {
      return;
    }
    const hasCommits = (await this.run(['rev-parse', '--verify', '--quiet', 'HEAD'])).code === 0;
    if (!hasCommits) {
      await this.git(['checkout', '-B', this.branch, `origin/${this.branch}`]);
      return;
    }
    const upToDate = await this.run(['merge-base', '--is-ancestor', `origin/${this.branch}`, 'HEAD']);
    if (upToDate.code === 0) {
      return;
    }
    const rebase = await this.run(['rebase', '--autostash', `origin/${this.branch}`]);
    if (rebase.code !== 0) {
      await this.run(['rebase', '--abort']);
      throw new GitEngineError('conflict', 'Rebase failed; local session files preserved');
    }
  }

  /** @returns `false` se il push e' stato rifiutato perche' non fast-forward. */
  private async push(): Promise<boolean> {
    if ((await this.run(['rev-parse', '--verify', '--quiet', 'HEAD'])).code !== 0) {
      return true;
    }
    if (await this.remoteBranchExists()) {
      const ahead = await this.git(['rev-list', '--count', `origin/${this.branch}..HEAD`]);
      if (ahead.stdout.trim() === '0') {
        return true;
      }
    }
    const result = await this.run(['push', 'origin', `HEAD:refs/heads/${this.branch}`]);
    if (result.code === 0) {
      return true;
    }
    if (REJECTED_PATTERN.test(result.stderr) && !result.timedOut) {
      return false;
    }
    throw this.classify(result);
  }
}
