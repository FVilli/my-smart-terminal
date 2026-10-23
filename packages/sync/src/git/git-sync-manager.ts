import type { CoordinatorServices, SyncStatus } from '../protocol';
import { SyncScheduler, type SyncSchedulerOptions } from '../sync-scheduler';
import { GitEngine, type GitEngineOptions } from './git-engine';

export interface GitSyncManagerOptions extends GitEngineOptions {
  debounceMs?: number;
  maxWaitMs?: number;
  fetchIntervalMs?: number;
  timers?: SyncSchedulerOptions['timers'];
  /** Tempo massimo di attesa del flush finale in `stop()` (default 5 s). */
  flushTimeoutMs?: number;
}

const DEFAULT_FLUSH_TIMEOUT_MS = 5_000;

/** Possiede `GitEngine` e `SyncScheduler` del primary: `markDirty` passa dal debounce, il fetch periodico parte con `start()`. */
export class GitSyncManager {
  private readonly engine: GitEngine;
  private readonly scheduler: SyncScheduler;
  private readonly flushTimeoutMs: number;

  constructor(options: GitSyncManagerOptions) {
    const { debounceMs, maxWaitMs, fetchIntervalMs, timers, flushTimeoutMs, ...engineOptions } = options;
    this.engine = new GitEngine(engineOptions);
    this.flushTimeoutMs = flushTimeoutMs ?? DEFAULT_FLUSH_TIMEOUT_MS;
    this.scheduler = new SyncScheduler({
      sync: () => this.engine.syncOnce(),
      fetch: async () => {
        const status = await this.engine.fetchOnly();
        if (status.state === 'dirty') {
          this.scheduler.notifyDirty(); // remote tornato raggiungibile: ritenta il push
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
      // l'errore e' riportato dal primo syncOnce(): l'avvio dell'app non deve dipendere da Git
    }
    this.scheduler.start();
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

  /** Sync immediato dei dirty pendenti (chiusura sessione/app). */
  flush(): Promise<void> {
    return this.scheduler.flush();
  }

  /** Flush best-effort con timeout, poi ferma i timer. Non lancia e non blocca oltre `flushTimeoutMs`. */
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
    return { syncStatus: () => this.status, syncDirty: () => this.markDirty() };
  }
}
