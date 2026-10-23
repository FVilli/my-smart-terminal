import type { CoordinatorServices, SyncStatus } from '../protocol';
import { SyncScheduler, type SyncSchedulerOptions } from '../sync-scheduler';
import { GitEngine, type GitEngineOptions } from './git-engine';

export interface GitSyncManagerOptions extends GitEngineOptions {
  debounceMs?: number;
  maxWaitMs?: number;
  fetchIntervalMs?: number;
  timers?: SyncSchedulerOptions['timers'];
  /** Maximum wait time for the final flush in `stop()` (default 5 s). */
  flushTimeoutMs?: number;
  /** Called after a periodic fetch that integrated remote commits. */
  onRemoteIntegrated?: (result: { changed: boolean }) => void;
}

const DEFAULT_FLUSH_TIMEOUT_MS = 5_000;

/** Owns the primary's `GitEngine` and `SyncScheduler`: `markDirty` goes through debounce, and periodic fetch starts with `start()`. */
export class GitSyncManager {
  private readonly engine: GitEngine;
  private readonly scheduler: SyncScheduler;
  private readonly flushTimeoutMs: number;

  constructor(options: GitSyncManagerOptions) {
    const { debounceMs, maxWaitMs, fetchIntervalMs, timers, flushTimeoutMs, onRemoteIntegrated, ...engineOptions } = options;
    this.engine = new GitEngine(engineOptions);
    this.flushTimeoutMs = flushTimeoutMs ?? DEFAULT_FLUSH_TIMEOUT_MS;
    this.scheduler = new SyncScheduler({
      sync: () => this.engine.syncOnce(),
      fetch: async () => {
        const { changed, status } = await this.engine.integrateRemote();
        if (changed) {
          onRemoteIntegrated?.({ changed });
        }
        if (status.state === 'dirty') {
          this.scheduler.notifyDirty(); // remote reachable again: retry the push
        }
        return status;
      },
      ...(debounceMs !== undefined && { debounceMs }),
      ...(maxWaitMs !== undefined && { maxWaitMs }),
      ...(fetchIntervalMs !== undefined && { fetchIntervalMs }),
      ...(timers !== undefined && { timers }),
    });
  }

  async start(): Promise<void> {
    try {
      await this.engine.initIfNeeded();
    } catch {
      // the error is reported by the first syncOnce(): app startup must not depend on Git
    }
    this.scheduler.start();
  }

  /** Only `git fetch origin` (no integration); the timer uses `integrateRemote`. */
  fetchOnly(): Promise<SyncStatus> {
    return this.engine.fetchOnly();
  }

  get status(): SyncStatus {
    return this.engine.status;
  }

  get remoteConfigured(): boolean {
    return this.engine.hasRemote;
  }

  markDirty(): void {
    this.engine.markDirty();
    this.scheduler.notifyDirty();
  }

  /** Immediate sync of pending dirty state (session/app close). */
  flush(): Promise<void> {
    return this.scheduler.flush();
  }

  /** Best-effort flush with timeout, then stop timers. Does not throw or block beyond `flushTimeoutMs`. */
  async stop(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, this.flushTimeoutMs);
    });
    try {
      await Promise.race([this.flush().catch(() => undefined), timeout]);
    } finally {
      clearTimeout(timer);
    }
    await Promise.race([this.scheduler.stop(), new Promise<void>((resolve) => setTimeout(resolve, this.flushTimeoutMs).unref())]);
  }

  asServices(): Pick<CoordinatorServices, 'syncStatus' | 'syncDirty'> {
    return { syncStatus: () => ({ ...this.status, remoteConfigured: this.remoteConfigured }), syncDirty: () => this.markDirty() };
  }
}
