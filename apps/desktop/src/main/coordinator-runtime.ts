import { FileSessionIdAllocator, type AllocateSessionRequest, type AllocatedSession, type SessionIdAllocator } from '@smart-terminal/data';
import type { SearchQueryRequest, SearchQueryResult } from '@smart-terminal/contracts';
import {
  Coordinator,
  CoordinatorClientError,
  GitSyncManager,
  RemoteSessionIdAllocator,
  type CoordinatorOptions,
  type CoordinatorRequester,
  type CoordinatorRole,
  type PrimaryHandle,
} from '@smart-terminal/sync';
import { resolveDataPaths, type DataPaths } from './data-runtime';
import { SearchService } from './search-service';

export interface CoordinatorRuntimeOptions {
  userDataPath: string;
  env?: NodeJS.ProcessEnv;
  hostname?: () => string;
  /** Solo test: tempi di heartbeat/stale/takeover. */
  timing?: Pick<CoordinatorOptions, 'heartbeatMs' | 'staleMs' | 'takeoverPollMs'>;
}

interface PrimaryResources {
  search: SearchService;
  git: GitSyncManager;
}

/**
 * Allocatore che sceglie a ogni chiamata: file locale se questa istanza e' primary, RPC verso il primary altrimenti.
 * Se il primary non risponde (es. e' appena morto) ripiega sul file allocator, che e' gia' sicuro tra processi.
 */
export class SwitchingSessionIdAllocator implements SessionIdAllocator {
  constructor(
    private readonly isPrimary: () => boolean,
    private readonly local: SessionIdAllocator,
    private readonly remote: SessionIdAllocator,
  ) {}

  async allocate(request: AllocateSessionRequest): Promise<AllocatedSession> {
    if (this.isPrimary()) {
      return this.local.allocate(request);
    }
    try {
      return await this.remote.allocate(request);
    } catch (error) {
      if (error instanceof CoordinatorClientError && error.code === 'COORDINATOR_UNAVAILABLE') {
        return this.local.allocate(request);
      }
      throw error;
    }
  }
}

/** Orchestra coordinator, git sync e ricerca nel main process; il ruolo puo' cambiare a runtime senza riavviare la finestra. */
export class CoordinatorRuntime {
  readonly paths: DataPaths;
  readonly coordinator: Coordinator;
  readonly allocator: SessionIdAllocator;
  private resources: PrimaryResources | undefined;
  private readonly fileAllocator: FileSessionIdAllocator;

  constructor(private readonly options: CoordinatorRuntimeOptions) {
    const env = options.env ?? process.env;
    this.paths = resolveDataPaths(options.userDataPath, env, options.hostname);
    this.fileAllocator = new FileSessionIdAllocator({
      dataRepoPath: this.paths.dataRepoPath,
      machine: this.paths.machine,
      lockDir: this.paths.lockDir,
    });
    this.coordinator = new Coordinator({
      userDataPath: options.userDataPath,
      ...options.timing,
      createPrimary: () => this.createPrimary(env),
    });
    const requester: CoordinatorRequester = this.coordinator;
    this.allocator = new SwitchingSessionIdAllocator(
      () => this.coordinator.isPrimary,
      this.fileAllocator,
      new RemoteSessionIdAllocator(requester),
    );
  }

  get isPrimary(): boolean {
    return this.coordinator.isPrimary;
  }

  start(): Promise<void> {
    return this.coordinator.start();
  }

  stop(): Promise<void> {
    return this.coordinator.stop();
  }

  onRoleChanged(listener: (role: CoordinatorRole) => void): () => void {
    return this.coordinator.onRoleChange(listener);
  }

  /** Ricerca: indice locale se primary, altrimenti inoltrata al primary via RPC. */
  async query(request: SearchQueryRequest): Promise<SearchQueryResult> {
    const resources = this.resources;
    if (this.coordinator.isPrimary && resources !== undefined) {
      return resources.search.query(request);
    }
    return this.coordinator.request<SearchQueryResult>('search.query', { ...request });
  }

  /** Dopo una scrittura history/clipboard/fine sessione di questa istanza: aggiorna l'indice e segnala dirty al primary. */
  notifyWrite(sessionDirectory: string): void {
    const resources = this.resources;
    if (this.coordinator.isPrimary && resources !== undefined) {
      resources.search.upsertSession(sessionDirectory);
      resources.git.markDirty();
      return;
    }
    void this.coordinator
      .request('search.upsert', { sessionDirectory })
      .then(() => this.coordinator.request('sync.dirty'))
      .catch(() => undefined); // best effort: l'indice si riallinea con refresh e il sync al prossimo ciclo
  }

  /** Rilascio sincrono del lock primary per le uscite che non passano da `before-quit` (es. `app.exit`). */
  releaseLockSync(): void {
    this.coordinator.releaseLockSync();
  }

  private async createPrimary(env: NodeJS.ProcessEnv): Promise<PrimaryHandle> {
    const git = new GitSyncManager({
      repoPath: this.paths.dataRepoPath,
      machine: this.paths.machine,
      remote: env['SMART_TERMINAL_GIT_REMOTE'],
      branch: env['SMART_TERMINAL_GIT_BRANCH'] || undefined,
    });
    await git.start();
    const search = new SearchService(this.paths.dataRepoPath);
    this.resources = { search, git };
    return {
      services: {
        allocate: (request) => this.fileAllocator.allocate(request),
        searchQuery: (query) => search.query({ ...query }).entries,
        searchUpsert: (dir) => search.upsertSession(dir),
        searchRefresh: () => search.refresh(),
        ...git.asServices(),
      },
      stop: async () => {
        this.resources = undefined;
        await git.stop();
      },
    };
  }
}
