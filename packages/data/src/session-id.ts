import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter';
import {
  COUNTER_FILE_NAME,
  buildSessionDirectoryName,
  formatIsoWithOffset,
  formatSessionLabel,
  isValidDestination,
  isValidMachine,
  machineDirectory,
  normalizeDestination,
  parseSessionDirectoryName,
  sessionFilePaths,
  SESSIONS_DIRECTORY,
  SessionPathError,
} from './paths';
import { createSessionDocuments, SCHEMA_VERSION, writeFileAtomic, type SessionKind, type SessionMeta } from './schema';

export type SessionIdErrorCode = 'SESSION_ID_LOCK_TIMEOUT' | 'SESSION_ID_INVALID_REQUEST' | 'SESSION_ID_EXHAUSTED';

export class SessionIdError extends Error {
  constructor(readonly code: SessionIdErrorCode) {
    super(code);
    this.name = 'SessionIdError';
  }
}

export interface AllocateSessionRequest {
  windowId: string;
  kind: SessionKind;
  sshAlias?: string;
  cwdInitial: string;
}

export interface AllocatedSession {
  sessionId: string;
  sequence: number;
  label: string;
  /** Path relative to the data repository, using `/` as the separator. */
  relativeDir: string;
  absoluteDir: string;
  sessionFile: string;
  historyFile: string;
  clipboardFile: string;
  startedAt: string;
}

export interface SessionIdAllocator {
  allocate(request: AllocateSessionRequest): Promise<AllocatedSession>;
}

export interface FileSessionIdAllocatorOptions {
  dataRepoPath: string;
  machine: string;
  lockDir: string;
  clock?: () => Date;
  pid?: number;
  isPidAlive?: (pid: number) => boolean;
  staleMs?: number;
  timeoutMs?: number;
  retryMs?: number;
}

interface LockOwner {
  pid: number;
  nonce: string;
  created_at: string;
  heartbeat_at: string;
}

const OWNER_FILE = 'owner.json';
const MAX_DIRECTORY_COLLISIONS = 1000;

function assertRealDirectory(directory: string): void {
  try {
    const stat = fs.lstatSync(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new SessionPathError('PATH_TRAVERSAL');
    }
  } catch (error) {
    if (error instanceof SessionPathError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new SessionPathError('PATH_TRAVERSAL');
  }
}

export function defaultIsPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class FileSessionIdAllocator implements SessionIdAllocator {
  private readonly dataRepoPath: string;
  private readonly machine: string;
  private readonly lockPath: string;
  private readonly lockParent: string;
  private readonly clock: () => Date;
  private readonly pid: number;
  private readonly isPidAlive: (pid: number) => boolean;
  private readonly staleMs: number;
  private readonly timeoutMs: number;
  private readonly retryMs: number;

  constructor(options: FileSessionIdAllocatorOptions) {
    if (!isValidMachine(options.machine)) {
      throw new SessionPathError('PATH_INVALID_MACHINE');
    }
    this.dataRepoPath = path.resolve(options.dataRepoPath);
    this.machine = options.machine;
    this.lockParent = path.resolve(options.lockDir);
    const digest = createHash('sha256').update(`${this.dataRepoPath}\0${this.machine}`).digest('hex').slice(0, 16);
    this.lockPath = path.join(this.lockParent, `session-id-${digest}.lock`);
    this.clock = options.clock ?? (() => new Date());
    this.pid = options.pid ?? process.pid;
    this.isPidAlive = options.isPidAlive ?? defaultIsPidAlive;
    this.staleMs = options.staleMs ?? 10_000;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.retryMs = options.retryMs ?? 25;
  }

  async allocate(request: AllocateSessionRequest): Promise<AllocatedSession> {
    const destination = request.kind === 'ssh' ? normalizeDestination(request.sshAlias ?? '') : 'local';
    if (
      !isValidDestination(destination) ||
      request.windowId.length === 0 ||
      request.cwdInitial.length === 0 ||
      (request.kind === 'ssh') !== (request.sshAlias !== undefined && request.sshAlias.length > 0)
    ) {
      throw new SessionIdError('SESSION_ID_INVALID_REQUEST');
    }
    const nonce = await this.acquire();
    try {
      return this.allocateLocked(request, destination);
    } finally {
      this.release(nonce);
    }
  }

  private allocateLocked(request: AllocateSessionRequest, destination: string): AllocatedSession {
    const machineDir = machineDirectory(this.dataRepoPath, this.machine);
    assertRealDirectory(path.join(this.dataRepoPath, SESSIONS_DIRECTORY));
    assertRealDirectory(machineDir);
    fs.mkdirSync(machineDir, { recursive: true });
    const counterFile = path.join(machineDir, COUNTER_FILE_NAME);
    let last = this.readCounter(counterFile) ?? this.maxExistingSequence(machineDir);

    for (let attempt = 0; attempt < MAX_DIRECTORY_COLLISIONS; attempt += 1) {
      const sequence = last + 1;
      if (!Number.isSafeInteger(sequence)) {
        throw new SessionIdError('SESSION_ID_EXHAUSTED');
      }
      const startedAtDate = this.clock();
      // Reserve the ID before using it: a crash can leave a gap, but never causes reuse.
      this.writeCounter(counterFile, sequence, startedAtDate);
      last = sequence;

      const directoryName = buildSessionDirectoryName(startedAtDate, sequence, destination);
      const absoluteDir = path.join(machineDir, directoryName);
      try {
        fs.mkdirSync(absoluteDir);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          continue;
        }
        throw error;
      }

      const label = formatSessionLabel(sequence);
      const startedAt = formatIsoWithOffset(startedAtDate);
      const meta: SessionMeta = {
        schema_version: SCHEMA_VERSION,
        session_id: label,
        machine: this.machine,
        created_at: startedAt,
        window_id: request.windowId,
        kind: request.kind,
        ...(request.sshAlias !== undefined ? { ssh_alias: request.sshAlias } : {}),
        cwd_initial: request.cwdInitial,
        started_at: startedAt,
      };
      const files = sessionFilePaths(absoluteDir);
      try {
        const documents = createSessionDocuments(meta);
        writeFileAtomic(files.historyFile, documents.history);
        writeFileAtomic(files.clipboardFile, documents.clipboard);
        writeFileAtomic(files.sessionFile, documents.session);
      } catch (error) {
        fs.rmSync(absoluteDir, { recursive: true, force: true });
        throw error;
      }
      return {
        sessionId: label,
        sequence,
        label,
        relativeDir: `${SESSIONS_DIRECTORY}/${this.machine}/${directoryName}`,
        absoluteDir,
        ...files,
        startedAt,
      };
    }
    throw new SessionIdError('SESSION_ID_EXHAUSTED');
  }

  private readCounter(counterFile: string): number | null {
    try {
      const parsed = parseFrontmatter(fs.readFileSync(counterFile, 'utf8'));
      const { data } = parsed;
      const lastSession = data['last_session'];
      if (
        !parsed.hasFrontmatter ||
        data['schema_version'] !== SCHEMA_VERSION ||
        data['machine'] !== this.machine ||
        typeof lastSession !== 'number' ||
        !Number.isSafeInteger(lastSession) ||
        lastSession < 0
      ) {
        return null;
      }
      return lastSession;
    } catch {
      return null;
    }
  }

  private writeCounter(counterFile: string, lastSession: number, now: Date): void {
    writeFileAtomic(
      counterFile,
      serializeFrontmatter({
        schema_version: SCHEMA_VERSION,
        machine: this.machine,
        last_session: lastSession,
        updated_at: formatIsoWithOffset(now),
      }),
    );
  }

  private maxExistingSequence(machineDir: string): number {
    let max = 0;
    for (const entry of fs.readdirSync(machineDir, { withFileTypes: true })) {
      const parsed = entry.isDirectory() ? parseSessionDirectoryName(entry.name) : null;
      if (parsed !== null && parsed.sequence > max) {
        max = parsed.sequence;
      }
    }
    return max;
  }

  private async acquire(): Promise<string> {
    fs.mkdirSync(this.lockParent, { recursive: true });
    const deadline = Date.now() + this.timeoutMs;
    for (;;) {
      const nonce = randomUUID();
      try {
        fs.mkdirSync(this.lockPath);
        const now = formatIsoWithOffset(this.clock());
        const owner: LockOwner = { pid: this.pid, nonce, created_at: now, heartbeat_at: now };
        writeFileAtomic(path.join(this.lockPath, OWNER_FILE), JSON.stringify(owner));
        return nonce;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          // mkdir succeeded but writing the owner failed: do not leave an orphaned lock
          if (fs.existsSync(this.lockPath) && this.readOwner() === null) {
            fs.rmSync(this.lockPath, { recursive: true, force: true });
          }
          throw error;
        }
      }
      if (this.recoverIfStale()) {
        continue;
      }
      if (Date.now() >= deadline) {
        throw new SessionIdError('SESSION_ID_LOCK_TIMEOUT');
      }
      await sleep(this.retryMs);
    }
  }

  private readOwner(): LockOwner | null {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(path.join(this.lockPath, OWNER_FILE), 'utf8'));
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        Number.isInteger((parsed as LockOwner).pid) &&
        typeof (parsed as LockOwner).nonce === 'string' &&
        typeof (parsed as LockOwner).heartbeat_at === 'string' &&
        !Number.isNaN(Date.parse((parsed as LockOwner).heartbeat_at))
      ) {
        return parsed as LockOwner;
      }
    } catch {
      // unreadable
    }
    return null;
  }

  /**
   * Removes the lock only when it is older than `staleMs` and its owner is dead or unreadable.
   * Recovery atomically renames the directory and verifies the observed nonce: a lock
   * reclaimed by mistake is restored.
   */
  private recoverIfStale(): boolean {
    const owner = this.readOwner();
    const nowMs = this.clock().getTime();
    let ageMs: number;
    if (owner !== null) {
      ageMs = nowMs - Date.parse(owner.heartbeat_at);
      if (ageMs <= this.staleMs || this.isPidAlive(owner.pid)) {
        return false;
      }
    } else {
      try {
        ageMs = nowMs - fs.statSync(this.lockPath).mtimeMs;
      } catch {
        return true; // the lock disappeared: retry immediately
      }
      if (ageMs <= this.staleMs) {
        return false;
      }
    }
    const graveyard = `${this.lockPath}.stale-${randomUUID()}`;
    try {
      fs.renameSync(this.lockPath, graveyard);
    } catch {
      return true; // another process already reclaimed or released it
    }
    const moved = (() => {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(graveyard, OWNER_FILE), 'utf8')) as Partial<LockOwner>;
        return parsed.nonce ?? null;
      } catch {
        return null;
      }
    })();
    if ((owner?.nonce ?? null) !== moved) {
      try {
        fs.renameSync(graveyard, this.lockPath);
        return false;
      } catch {
        // the lock was recreated by another process: ours was not recoverable, discard it
      }
    }
    fs.rmSync(graveyard, { recursive: true, force: true });
    return true;
  }

  private release(nonce: string): void {
    const owner = this.readOwner();
    if (owner !== null && owner.nonce !== nonce) {
      return;
    }
    fs.rmSync(this.lockPath, { recursive: true, force: true });
  }
}
