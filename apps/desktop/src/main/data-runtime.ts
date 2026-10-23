import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  FileSessionIdAllocator,
  formatIsoWithOffset,
  normalizeMachine,
  parseSessionDocument,
  serializeSessionDocument,
  writeFileAtomic,
  type AllocatedSession,
  type SessionIdAllocator,
} from '@smart-terminal/data';
import type { AppConfig } from './app-config';

export interface DataRuntimeOptions {
  /** `app.getPath('userData')`. */
  userDataPath: string;
  env?: NodeJS.ProcessEnv;
  hostname?: () => string;
  clock?: () => Date;
  /** Config letta da `config.md`: precedenza env > config > default. */
  config?: AppConfig | undefined;
  /** Solo test: sostituisce l'allocatore su file. */
  allocator?: SessionIdAllocator;
}

export type SessionDestination = { kind: 'local'; cwd: string } | { kind: 'ssh'; sshAlias: string; cwd: string };

export interface CreatedSession {
  allocation: AllocatedSession;
  machine: string;
}

export interface DataPaths {
  dataRepoPath: string;
  machine: string;
  lockDir: string;
}

/**
 * Percorsi e machine del repo dati. Precedenza: env (`SMART_TERMINAL_DATA_REPO`, `SMART_TERMINAL_MACHINE`) >
 * `config.md` > default (`userData/data`, hostname). `process.env` non viene mai modificato.
 */
export function resolveDataPaths(
  userDataPath: string,
  env: NodeJS.ProcessEnv = process.env,
  hostname: () => string = os.hostname,
  config?: AppConfig,
): DataPaths {
  const repoOverride = env['SMART_TERMINAL_DATA_REPO'];
  const machineOverride = env['SMART_TERMINAL_MACHINE'];
  const repo =
    repoOverride !== undefined && repoOverride.length > 0 ? repoOverride : (config?.dataRepoPath ?? path.join(userDataPath, 'data'));
  const machine = machineOverride !== undefined && machineOverride.length > 0 ? machineOverride : (config?.machineName ?? hostname());
  return {
    dataRepoPath: path.resolve(repo),
    machine: normalizeMachine(machine),
    lockDir: path.join(userDataPath, 'coordinator', 'locks'),
  };
}

/**
 * Collega il main process al repo dati Markdown: risolve percorsi e machine,
 * alloca ID/file di sessione e ne finalizza `ended_at`.
 */
export class DataRuntime {
  readonly dataRepoPath: string;
  readonly machine: string;
  readonly lockDir: string;
  private readonly clock: () => Date;
  private readonly allocator: SessionIdAllocator;
  private readonly sessions = new Map<string, AllocatedSession>();
  private sessionEndedListener: ((sessionDirectory: string) => void) | undefined;

  constructor(options: DataRuntimeOptions) {
    const paths = resolveDataPaths(options.userDataPath, options.env, options.hostname, options.config);
    this.dataRepoPath = paths.dataRepoPath;
    this.machine = paths.machine;
    this.lockDir = paths.lockDir;
    this.clock = options.clock ?? (() => new Date());
    fs.mkdirSync(path.join(this.dataRepoPath, 'sessions'), { recursive: true });
    this.allocator =
      options.allocator ??
      new FileSessionIdAllocator({
        dataRepoPath: this.dataRepoPath,
        machine: this.machine,
        lockDir: this.lockDir,
        clock: this.clock,
      });
  }

  /** Notificata (con la directory relativa) dopo che `ended_at` e' stato scritto. */
  onSessionEnded(listener: (sessionDirectory: string) => void): void {
    this.sessionEndedListener = listener;
  }

  async createSession(windowId: string, destination: SessionDestination): Promise<CreatedSession> {
    const allocation = await this.allocator.allocate({
      windowId,
      kind: destination.kind,
      ...(destination.kind === 'ssh' ? { sshAlias: destination.sshAlias } : {}),
      cwdInitial: destination.cwd,
    });
    this.sessions.set(allocation.sessionId, allocation);
    return { allocation, machine: this.machine };
  }

  /** Scrive `ended_at` in session.md (atomico). Idempotente; errori di I/O sono assorbiti e restituiti come `false`. */
  endSession(sessionId: string): boolean {
    const allocation = this.sessions.get(sessionId);
    if (allocation === undefined) {
      return false;
    }
    this.sessions.delete(sessionId);
    try {
      const document = parseSessionDocument(fs.readFileSync(allocation.sessionFile, 'utf8'));
      if (document.meta.ended_at === undefined) {
        const meta = { ...document.meta, ended_at: formatIsoWithOffset(this.clock()) };
        writeFileAtomic(allocation.sessionFile, serializeSessionDocument(meta, document.extraFields, document.body));
      }
      this.sessionEndedListener?.(allocation.relativeDir);
      return true;
    } catch {
      return false;
    }
  }
}
