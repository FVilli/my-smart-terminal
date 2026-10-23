import type { CoordinatorServices, SyncStatus } from '../protocol';
import { GitEngine, type GitEngineOptions } from './git-engine';

/** Possiede il `GitEngine` del primary. Debounce e polling arriveranno con M04-T03: qui `markDirty` esegue subito un sync. */
export class GitSyncManager {
  private readonly engine: GitEngine;
  private stopped = false;
  private running: Promise<void> | undefined;
  private rerun = false;

  constructor(options: GitEngineOptions) {
    this.engine = new GitEngine(options);
  }

  async start(): Promise<void> {
    try {
      await this.engine.initIfNeeded();
    } catch {
      // l'errore e' riportato dal primo syncOnce(): l'avvio dell'app non deve dipendere da Git
    }
  }

  get status(): SyncStatus {
    return this.engine.status;
  }

  markDirty(): void {
    if (this.stopped) return;
    this.engine.markDirty();
    if (this.running !== undefined) {
      this.rerun = true; // coalesce: un solo sync successivo copre tutte le richieste arrivate nel frattempo
      return;
    }
    this.running = this.runLoop();
  }

  private async runLoop(): Promise<void> {
    do {
      this.rerun = false;
      await this.engine.syncOnce();
    } while (this.rerun && !this.stopped);
    this.running = undefined;
  }

  syncNow(): Promise<SyncStatus> {
    return this.engine.syncOnce();
  }

  /** Attende l'eventuale sync in corso (usato allo stop e nei test). */
  async stop(): Promise<void> {
    this.stopped = true;
    await this.running;
  }

  asServices(): Pick<CoordinatorServices, 'syncStatus' | 'syncDirty'> {
    return { syncStatus: () => this.status, syncDirty: () => this.markDirty() };
  }
}
