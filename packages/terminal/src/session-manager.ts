import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { PtyAdapter, PtyExitInfo, PtyProcessLike } from './pty';
import { buildLocalShellCommand } from './shell';
import { buildSshCommand, isValidSshAlias } from './ssh-config';

export const MAX_WRITE_BYTES = 64 * 1024;
export const MIN_DIMENSION = 1;
export const MAX_DIMENSION = 1000;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

export type TerminalErrorCode =
  | 'TERMINAL_INVALID_CWD'
  | 'TERMINAL_INVALID_DIMENSIONS'
  | 'TERMINAL_INVALID_SSH_ALIAS'
  | 'TERMINAL_DATA_TOO_LARGE'
  | 'TERMINAL_UNKNOWN_SESSION'
  | 'TERMINAL_SPAWN_FAILED'
  | 'TERMINAL_SESSION_ALLOCATION_FAILED';

/** Error with a code only: no path or system details in the message. */
export class TerminalError extends Error {
  constructor(readonly code: TerminalErrorCode) {
    super(code);
    this.name = 'TerminalError';
  }
}

export interface CreateSessionRequest {
  kind: 'local' | 'ssh';
  /** Required (and allowed only) with `kind: 'ssh'`. */
  sshAlias?: string;
  cwd?: string;
  cols?: number;
  rows?: number;
}

export interface SessionInfo {
  sessionId: string;
  kind: 'local' | 'ssh';
  /** SSH alias or `local`. */
  target: string;
  pid: number;
  cwd: string;
}

export interface SessionManagerEvents {
  data: (event: { sessionId: string; data: string }) => void;
  exit: (event: { sessionId: string; exitCode: number; signal?: number }) => void;
}

export interface SessionManagerOptions {
  adapter: PtyAdapter;
  generateId?: () => string;
  clock?: () => number;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homeDirectory?: () => string;
  /** ssh binary (default: `SMART_TERMINAL_SSH_BINARY` or `ssh`). */
  sshBinary?: string;
}

interface Session {
  info: SessionInfo;
  process: PtyProcessLike;
  createdAt: number;
}

function isValidDimension(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_DIMENSION && value <= MAX_DIMENSION;
}

export class SessionManager {
  private readonly sessions = new Map<string, Session>();
  private readonly listeners: { [K in keyof SessionManagerEvents]: Set<SessionManagerEvents[K]> } = {
    data: new Set(),
    exit: new Set(),
  };
  private readonly adapter: PtyAdapter;
  private readonly generateId: () => string;
  private readonly clock: () => number;
  private readonly env: NodeJS.ProcessEnv;
  private readonly platform: NodeJS.Platform;
  private readonly homeDirectory: () => string;
  private readonly sshBinary: string | undefined;

  constructor(options: SessionManagerOptions) {
    this.adapter = options.adapter;
    this.generateId = options.generateId ?? (() => globalThis.crypto.randomUUID());
    this.clock = options.clock ?? Date.now;
    this.env = options.env ?? process.env;
    this.platform = options.platform ?? process.platform;
    this.homeDirectory = options.homeDirectory ?? os.homedir;
    this.sshBinary = options.sshBinary;
  }

  on<K extends keyof SessionManagerEvents>(event: K, listener: SessionManagerEvents[K]): () => void {
    const set = this.listeners[event] as Set<SessionManagerEvents[K]>;
    set.add(listener);
    return () => set.delete(listener);
  }

  /** Validates the request and resolves defaults without starting anything. */
  prepare(request: CreateSessionRequest): { cwd: string; cols: number; rows: number } {
    if (request.kind === 'ssh') {
      if (!isValidSshAlias(request.sshAlias) || request.cwd !== undefined) {
        throw new TerminalError('TERMINAL_INVALID_SSH_ALIAS');
      }
    } else if (request.kind !== 'local' || request.sshAlias !== undefined) {
      throw new TerminalError('TERMINAL_INVALID_SSH_ALIAS');
    }
    const cwd = this.resolveCwd(request.cwd);
    const cols = request.cols ?? DEFAULT_COLS;
    const rows = request.rows ?? DEFAULT_ROWS;
    if (!isValidDimension(cols) || !isValidDimension(rows)) {
      throw new TerminalError('TERMINAL_INVALID_DIMENSIONS');
    }
    return { cwd, cols, rows };
  }

  /** Optional explicit `sessionId` (for example, `S<n>` assigned by the data runtime); default: generated UUID. */
  create(request: CreateSessionRequest, sessionId?: string): SessionInfo {
    const { cwd, cols, rows } = this.prepare(request);
    if (sessionId !== undefined && this.sessions.has(sessionId)) {
      throw new TerminalError('TERMINAL_SPAWN_FAILED');
    }

    const command =
      request.kind === 'ssh' && request.sshAlias !== undefined
        ? buildSshCommand(request.sshAlias, this.env, this.sshBinary)
        : buildLocalShellCommand(this.env, this.platform);
    let process: PtyProcessLike;
    try {
      process = this.adapter.spawn({ ...command, cwd, cols, rows });
    } catch {
      throw new TerminalError('TERMINAL_SPAWN_FAILED');
    }

    const id = sessionId ?? this.generateId();
    const session: Session = {
      info: { sessionId: id, kind: request.kind, target: request.kind === 'ssh' ? (request.sshAlias as string) : 'local', pid: process.pid, cwd },
      process,
      createdAt: this.clock(),
    };
    this.sessions.set(id, session);

    process.onData((data) => {
      if (this.sessions.get(id) === session) {
        this.emit('data', { sessionId: id, data });
      }
    });
    process.onExit((exit) => this.handleExit(session, exit));
    return { ...session.info };
  }

  write(sessionId: string, data: string): void {
    const session = this.require(sessionId);
    if (typeof data !== 'string' || Buffer.byteLength(data, 'utf8') > MAX_WRITE_BYTES) {
      throw new TerminalError('TERMINAL_DATA_TOO_LARGE');
    }
    session.process.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.require(sessionId);
    if (!isValidDimension(cols) || !isValidDimension(rows)) {
      throw new TerminalError('TERMINAL_INVALID_DIMENSIONS');
    }
    session.process.resize(cols, rows);
  }

  /** Terminates the shell; removal and the exit event occur when the process exits. */
  close(sessionId: string): void {
    this.require(sessionId).process.kill();
  }

  closeAll(): void {
    for (const session of [...this.sessions.values()]) {
      try {
        session.process.kill();
      } catch {
        // the process may have already exited
      }
    }
  }

  list(): SessionInfo[] {
    return [...this.sessions.values()]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((session) => ({ ...session.info }));
  }

  private handleExit(session: Session, exit: PtyExitInfo): void {
    if (this.sessions.get(session.info.sessionId) !== session) {
      return;
    }
    this.sessions.delete(session.info.sessionId);
    this.emit('exit', {
      sessionId: session.info.sessionId,
      exitCode: exit.exitCode,
      ...(exit.signal !== undefined && exit.signal !== 0 ? { signal: exit.signal } : {}),
    });
  }

  private require(sessionId: string): Session {
    const session = typeof sessionId === 'string' ? this.sessions.get(sessionId) : undefined;
    if (session === undefined) {
      throw new TerminalError('TERMINAL_UNKNOWN_SESSION');
    }
    return session;
  }

  private resolveCwd(cwd: string | undefined): string {
    if (cwd === undefined) {
      return this.homeDirectory();
    }
    if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) {
      throw new TerminalError('TERMINAL_INVALID_CWD');
    }
    try {
      if (!fs.statSync(cwd).isDirectory()) {
        throw new TerminalError('TERMINAL_INVALID_CWD');
      }
    } catch {
      throw new TerminalError('TERMINAL_INVALID_CWD');
    }
    return cwd;
  }

  private emit<K extends keyof SessionManagerEvents>(event: K, payload: Parameters<SessionManagerEvents[K]>[0]): void {
    for (const listener of [...this.listeners[event]] as ((p: typeof payload) => void)[]) {
      listener(payload);
    }
  }
}
