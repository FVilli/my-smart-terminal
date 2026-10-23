import path from 'node:path';
import { CoordinatorClient } from './client';
import { PrimaryElection } from './election';
import type { CoordinatorServices } from './protocol';
import { CoordinatorServer } from './server';

export type CoordinatorRole = 'stopped' | 'primary' | 'secondary';

/** Resources created when the instance becomes primary; `stop` is called when it ceases to be one. */
export interface PrimaryHandle {
  services: CoordinatorServices;
  stop(): Promise<void> | void;
}

export interface CoordinatorOptions {
  userDataPath: string;
  createPrimary: () => Promise<PrimaryHandle> | PrimaryHandle;
  heartbeatMs?: number;
  staleMs?: number;
  /** Interval at which a secondary retries the election. */
  takeoverPollMs?: number;
  isPidAlive?: (pid: number) => boolean;
  clock?: () => Date;
}

type RoleListener = (role: CoordinatorRole) => void;

/** Election, server (if primary), client (always), and automatic takeover. Never blocks startup as a secondary. */
export class Coordinator {
  readonly client: CoordinatorClient;
  private readonly election: PrimaryElection;
  private readonly listeners = new Set<RoleListener>();
  private readonly takeoverPollMs: number;
  private currentRole: CoordinatorRole = 'stopped';
  private server: CoordinatorServer | undefined;
  private handle: PrimaryHandle | undefined;
  private pollTimer: NodeJS.Timeout | undefined;
  private transitions: Promise<void> = Promise.resolve();
  private stopped = true;

  constructor(private readonly options: CoordinatorOptions) {
    this.client = new CoordinatorClient({ userDataPath: options.userDataPath });
    this.takeoverPollMs = options.takeoverPollMs ?? 2000;
    this.election = new PrimaryElection({
      coordinatorDir: path.join(options.userDataPath, 'coordinator'),
      heartbeatMs: options.heartbeatMs,
      staleMs: options.staleMs,
      isPidAlive: options.isPidAlive,
      clock: options.clock,
      onLost: () => this.enqueue(() => this.demote()),
    });
  }

  get role(): CoordinatorRole {
    return this.currentRole;
  }

  get isPrimary(): boolean {
    return this.currentRole === 'primary';
  }

  onRoleChange(listener: RoleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  request<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 5000): Promise<T> {
    return this.client.request<T>(method, params, timeoutMs);
  }

  async start(): Promise<void> {
    this.stopped = false;
    await this.enqueue(() => this.elect());
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.clearPoll();
    await this.enqueue(async () => {
      await this.teardownPrimary();
      this.election.release();
      this.setRole('stopped');
    });
  }

  /** Synchronous release of only the lock (for `process.on('exit')`); stale sockets and tokens are overwritten by the next primary. */
  releaseLockSync(): void {
    this.stopped = true;
    this.clearPoll();
    this.election.release();
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.transitions.then(task, task);
    this.transitions = run.catch(() => undefined);
    return run;
  }

  private async elect(): Promise<void> {
    if (this.stopped || this.currentRole === 'primary') {
      return;
    }
    try {
      if (this.election.tryAcquire() === 'acquired') {
        const handle = await this.options.createPrimary();
        this.handle = handle;
        const server = new CoordinatorServer({ userDataPath: this.options.userDataPath, services: handle.services });
        this.server = server;
        await server.start();
        this.setRole('primary');
        return;
      }
    } catch {
      await this.teardownPrimary();
      this.election.release();
    }
    this.setRole('secondary');
    this.schedulePoll();
  }

  private async demote(): Promise<void> {
    if (this.currentRole !== 'primary') {
      return;
    }
    await this.teardownPrimary();
    this.setRole('secondary');
    this.schedulePoll();
  }

  private async teardownPrimary(): Promise<void> {
    const server = this.server;
    const handle = this.handle;
    this.server = undefined;
    this.handle = undefined;
    await server?.stop();
    await handle?.stop();
  }

  private schedulePoll(): void {
    this.clearPoll();
    if (this.stopped) {
      return;
    }
    this.pollTimer = setTimeout(() => {
      this.pollTimer = undefined;
      void this.enqueue(() => this.elect());
    }, this.takeoverPollMs);
    this.pollTimer.unref();
  }

  private clearPoll(): void {
    if (this.pollTimer !== undefined) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private setRole(role: CoordinatorRole): void {
    if (role === this.currentRole) {
      return;
    }
    this.currentRole = role;
    for (const listener of this.listeners) {
      listener(role);
    }
  }
}
