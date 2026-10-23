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

export interface DataRuntimeOptions {
  /** `app.getPath('userData')`. */
  userDataPath: string;
  env?: NodeJS.ProcessEnv;
  hostname?: () => string;
  clock?: () => Date;
  /** Solo test: sostituisce l'allocatore su file. */
  allocator?: SessionIdAllocator;
}

export interface SessionDestination {
  kind: 'local';
  cwd: string;
}

export interface CreatedSession {
  allocation: AllocatedSession;
  machine: string;
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

  constructor(options: DataRuntimeOptions) {
    const env = options.env ?? process.env;
    const repoOverride = env['SMART_TERMINAL_DATA_REPO'];
    this.dataRepoPath = path.resolve(
      repoOverride !== undefined && repoOverride.length > 0 ? repoOverride : path.join(options.userDataPath, 'data'),
    );
    const machineOverride = env['SMART_TERMINAL_MACHINE'];
    this.machine = normalizeMachine(
      machineOverride !== undefined && machineOverride.length > 0 ? machineOverride : (options.hostname ?? os.hostname)(),
    );
    this.lockDir = path.join(options.userDataPath, 'coordinator', 'locks');
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

  async createSession(windowId: string, destination: SessionDestination): Promise<CreatedSession> {
    const allocation = await this.allocator.allocate({
      windowId,
      kind: destination.kind,
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
      return true;
    } catch {
      return false;
    }
  }
}
