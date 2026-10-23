export const DEFAULT_SYNC_DEBOUNCE_MS = 10_000;
export const DEFAULT_SYNC_MAX_WAIT_MS = 60_000;
export const DEFAULT_SYNC_FETCH_INTERVAL_MS = 15_000;

export interface SyncSchedulerTimers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface SyncSchedulerOptions {
  /** Sync completo (commit sessions + fetch/rebase/push). */
  sync(): Promise<unknown>;
  /** Solo fetch: nessun commit/push. */
  fetch(): Promise<unknown>;
  debounceMs?: number;
  maxWaitMs?: number;
  fetchIntervalMs?: number;
  /** Timer iniettabili; default: `setTimeout`/`clearTimeout` globali (compatibili con i fake timers). */
  timers?: SyncSchedulerTimers;
  onStatus?: (event: { kind: 'sync' | 'fetch'; result: unknown }) => void;
  onError?: (error: unknown, kind: 'sync' | 'fetch') => void;
}

const defaultTimers: SyncSchedulerTimers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

/**
 * Pianifica i sync del primary: debounce dall'ultima modifica, max wait dalla prima modifica non ancora sincronizzata,
 * un solo sync alla volta (coalescing) e fetch periodico che non si sovrappone al sync.
 */
export class SyncScheduler {
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;
  private readonly fetchIntervalMs: number;
  private readonly timers: SyncSchedulerTimers;
  private pending = false;
  private stopped = false;
  private started = false;
  private debounceTimer: unknown;
  private maxWaitTimer: unknown;
  private fetchTimer: unknown;
  private syncRun: Promise<void> | undefined;
  private fetchRun: Promise<void> | undefined;

  constructor(private readonly options: SyncSchedulerOptions) {
    this.debounceMs = options.debounceMs ?? DEFAULT_SYNC_DEBOUNCE_MS;
    this.maxWaitMs = options.maxWaitMs ?? DEFAULT_SYNC_MAX_WAIT_MS;
    this.fetchIntervalMs = options.fetchIntervalMs ?? DEFAULT_SYNC_FETCH_INTERVAL_MS;
    this.timers = options.timers ?? defaultTimers;
  }

  get hasPendingChanges(): boolean {
    return this.pending;
  }

  notifyDirty(): void {
    if (this.stopped) return;
    this.pending = true;
    if (this.syncRun !== undefined) {
      return; // coalescing: il passaggio extra parte a fine sync
    }
    this.clearTimer('debounceTimer');
    this.debounceTimer = this.timers.setTimeout(() => this.trigger(), this.debounceMs);
    this.maxWaitTimer ??= this.timers.setTimeout(() => this.trigger(), this.maxWaitMs);
  }

  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    this.scheduleFetch();
  }

  /** Esegue subito il sync se c'e' un dirty pendente e attende quello in corso. */
  async flush(): Promise<void> {
    if (this.pending && this.syncRun === undefined && !this.stopped) {
      this.trigger();
    }
    await this.syncRun;
  }

  /** Cancella i timer e attende l'eventuale sync/fetch in corso; nessun nuovo sync parte dopo. */
  async stop(): Promise<void> {
    this.stopped = true;
    this.clearTimer('debounceTimer');
    this.clearTimer('maxWaitTimer');
    this.clearTimer('fetchTimer');
    await Promise.all([this.syncRun, this.fetchRun]);
  }

  private trigger(): void {
    this.clearTimer('debounceTimer');
    this.clearTimer('maxWaitTimer');
    if (this.stopped || this.syncRun !== undefined || !this.pending) return;
    this.syncRun = this.runSyncLoop();
  }

  private async runSyncLoop(): Promise<void> {
    try {
      while (this.pending && !this.stopped) {
        this.pending = false;
        await this.guarded('sync', this.options.sync);
      }
    } finally {
      this.syncRun = undefined;
    }
  }

  private scheduleFetch(): void {
    this.fetchTimer = this.timers.setTimeout(() => {
      this.fetchTimer = undefined;
      if (this.stopped) return;
      if (this.syncRun === undefined && this.fetchRun === undefined) {
        this.fetchRun = this.guarded('fetch', this.options.fetch).finally(() => {
          this.fetchRun = undefined;
        });
      }
      this.scheduleFetch();
    }, this.fetchIntervalMs);
  }

  private async guarded(kind: 'sync' | 'fetch', action: () => Promise<unknown>): Promise<void> {
    try {
      const result = await action();
      this.options.onStatus?.({ kind, result });
    } catch (error) {
      this.options.onError?.(error, kind);
    }
  }

  private clearTimer(name: 'debounceTimer' | 'maxWaitTimer' | 'fetchTimer'): void {
    if (this[name] !== undefined) {
      this.timers.clearTimeout(this[name]);
      this[name] = undefined;
    }
  }
}
