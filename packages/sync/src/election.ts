import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defaultIsPidAlive, writeFileAtomic } from '@smart-terminal/data';

export const PRIMARY_LOCK_NAME = 'primary.lock';
const OWNER_FILE = 'owner.json';

export interface PrimaryLockOwner {
  pid: number;
  nonce: string;
  role: 'primary';
  started_at: string;
  heartbeat_at: string;
}

export interface PrimaryElectionOptions {
  /** `userData/coordinator`. */
  coordinatorDir: string;
  /** Chiamata una sola volta se heartbeat o ownership falliscono dopo l'acquisizione. */
  onLost?: () => void;
  pid?: number;
  clock?: () => Date;
  isPidAlive?: (pid: number) => boolean;
  heartbeatMs?: number;
  staleMs?: number;
}

export type AcquireResult = 'acquired' | 'held';

function parseOwner(raw: string): PrimaryLockOwner | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }
    const v = value as Record<string, unknown>;
    if (
      typeof v['pid'] === 'number' &&
      Number.isInteger(v['pid']) &&
      typeof v['nonce'] === 'string' &&
      v['role'] === 'primary' &&
      typeof v['started_at'] === 'string' &&
      typeof v['heartbeat_at'] === 'string'
    ) {
      return v as unknown as PrimaryLockOwner;
    }
  } catch {
    // owner illeggibile
  }
  return undefined;
}

/**
 * Elezione del primary tramite lock directory `primary.lock` (mkdir atomico) con heartbeat.
 * Un lock e' stale se l'heartbeat e' piu' vecchio di `staleMs` e il pid non e' vivo, oppure se
 * l'owner e' illeggibile e la directory non viene toccata da `staleMs`.
 */
export class PrimaryElection {
  readonly lockPath: string;
  private readonly clock: () => Date;
  private readonly pid: number;
  private readonly isPidAlive: (pid: number) => boolean;
  private readonly heartbeatMs: number;
  private readonly staleMs: number;
  private owner: PrimaryLockOwner | undefined;
  private timer: NodeJS.Timeout | undefined;
  private lastHeartbeatOk = 0;

  constructor(private readonly options: PrimaryElectionOptions) {
    this.lockPath = path.join(options.coordinatorDir, PRIMARY_LOCK_NAME);
    this.clock = options.clock ?? (() => new Date());
    this.pid = options.pid ?? process.pid;
    this.isPidAlive = options.isPidAlive ?? defaultIsPidAlive;
    this.heartbeatMs = options.heartbeatMs ?? 3000;
    this.staleMs = options.staleMs ?? 10_000;
  }

  get held(): boolean {
    return this.owner !== undefined;
  }

  get nonce(): string | undefined {
    return this.owner?.nonce;
  }

  readOwner(): PrimaryLockOwner | undefined {
    try {
      return parseOwner(fs.readFileSync(path.join(this.lockPath, OWNER_FILE), 'utf8'));
    } catch {
      return undefined;
    }
  }

  /** Sincrono e non bloccante: non attende mai il primary corrente. */
  tryAcquire(): AcquireResult {
    if (this.owner !== undefined) {
      return 'acquired';
    }
    fs.mkdirSync(this.options.coordinatorDir, { recursive: true, mode: 0o700 });
    if (this.mkdirLock()) {
      return 'acquired';
    }
    if (this.recoverIfStale() && this.mkdirLock()) {
      return 'acquired';
    }
    return 'held';
  }

  private mkdirLock(): boolean {
    try {
      fs.mkdirSync(this.lockPath, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return false;
      }
      throw error;
    }
    const now = this.clock().toISOString();
    const owner: PrimaryLockOwner = { pid: this.pid, nonce: randomUUID(), role: 'primary', started_at: now, heartbeat_at: now };
    try {
      writeFileAtomic(path.join(this.lockPath, OWNER_FILE), JSON.stringify(owner));
    } catch (error) {
      fs.rmSync(this.lockPath, { recursive: true, force: true });
      throw error;
    }
    this.owner = owner;
    this.lastHeartbeatOk = this.clock().getTime();
    this.timer = setInterval(() => this.heartbeat(), this.heartbeatMs);
    this.timer.unref();
    return true;
  }

  /** Rimuove il lock se stale tramite rename atomico, verificando il nonce osservato. */
  private recoverIfStale(): boolean {
    const observed = this.readOwner();
    const now = this.clock().getTime();
    if (observed !== undefined) {
      const heartbeat = Date.parse(observed.heartbeat_at);
      const age = Number.isNaN(heartbeat) ? Number.POSITIVE_INFINITY : now - heartbeat;
      if (age <= this.staleMs || this.isPidAlive(observed.pid)) {
        return false;
      }
    } else {
      try {
        if (now - fs.statSync(this.lockPath).mtimeMs <= this.staleMs) {
          return false;
        }
      } catch {
        return true; // il lock e' sparito nel frattempo: riprova mkdir
      }
    }
    const graveyard = `${this.lockPath}.stale-${randomUUID()}`;
    try {
      fs.renameSync(this.lockPath, graveyard);
    } catch {
      return false; // un altro processo ha gia' recuperato o rilasciato
    }
    const moved = parseOwner(this.safeRead(path.join(graveyard, OWNER_FILE)) ?? '');
    if (moved?.nonce !== observed?.nonce) {
      // Abbiamo spostato un lock diverso da quello giudicato stale: tentiamo di ripristinarlo.
      try {
        fs.renameSync(graveyard, this.lockPath);
      } catch {
        fs.rmSync(graveyard, { recursive: true, force: true });
      }
      return false;
    }
    fs.rmSync(graveyard, { recursive: true, force: true });
    return true;
  }

  private safeRead(file: string): string | undefined {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      return undefined;
    }
  }

  private heartbeat(): void {
    const owner = this.owner;
    if (owner === undefined) {
      return;
    }
    const current = this.readOwner();
    if (current?.nonce !== owner.nonce || this.clock().getTime() - this.lastHeartbeatOk > this.staleMs) {
      this.lose();
      return;
    }
    const next = { ...owner, heartbeat_at: this.clock().toISOString() };
    try {
      writeFileAtomic(path.join(this.lockPath, OWNER_FILE), JSON.stringify(next));
      this.owner = next;
      this.lastHeartbeatOk = this.clock().getTime();
    } catch {
      this.lose();
    }
  }

  private lose(): void {
    this.stopTimer();
    this.owner = undefined;
    this.options.onLost?.();
  }

  private stopTimer(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** Rilascia il lock solo se l'owner su disco ha il nostro nonce. */
  release(): void {
    const owner = this.owner;
    this.stopTimer();
    this.owner = undefined;
    if (owner === undefined || this.readOwner()?.nonce !== owner.nonce) {
      return;
    }
    const graveyard = `${this.lockPath}.released-${randomUUID()}`;
    try {
      fs.renameSync(this.lockPath, graveyard);
      fs.rmSync(graveyard, { recursive: true, force: true });
    } catch {
      // niente da rilasciare
    }
  }
}
