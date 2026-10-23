import {
  FileSessionIdAllocator,
  type AllocateSessionRequest,
  type AllocatedSession,
  type ClipboardTextSource,
  type SessionIdAllocator,
} from '@smart-terminal/data';
import type {
  ClipboardCaptureState,
  ClipboardConfigureRequest,
  SearchFacetsResult,
  SearchQueryRequest,
  SearchQueryResult,
  SearchRefreshedEvent,
  SyncStatusEvent,
} from '@smart-terminal/contracts';
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
import type { ClipboardBackend } from './clipboard-gateway';
import { ClipboardService } from './clipboard-service';
import type { AppConfig } from './app-config';
import { resolveDataPaths, type DataPaths } from './data-runtime';
import { SearchService } from './search-service';

export interface CoordinatorRuntimeOptions {
  userDataPath: string;
  env?: NodeJS.ProcessEnv;
  hostname?: () => string;
  /** Config letta da `config.md`: precedenza env > config > default. */
  config?: AppConfig | undefined;
  /** System clipboard text source: read only by the primary. */
  clipboardSource: ClipboardTextSource;
  /** Test only: intervallo di polling clipboard. */
  clipboardIntervalMs?: number;
  /** Test only: tempi di heartbeat/stale/takeover. */
  timing?: Pick<CoordinatorOptions, 'heartbeatMs' | 'staleMs' | 'takeoverPollMs'>;
}

const positiveInt = (value: string | undefined): number | undefined => {
  const parsed = Number(value);
  return value !== undefined && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

/** Git scheduler timings from env (`SMART_TERMINAL_SYNC_*`); invalid values fall back to defaults. */
export function resolveSyncTiming(env: NodeJS.ProcessEnv): { debounceMs?: number; maxWaitMs?: number; fetchIntervalMs?: number } {
  const debounceMs = positiveInt(env['SMART_TERMINAL_SYNC_DEBOUNCE_MS']);
  const maxWaitMs = positiveInt(env['SMART_TERMINAL_SYNC_MAX_WAIT_MS']);
  const fetchIntervalMs = positiveInt(env['SMART_TERMINAL_SYNC_FETCH_INTERVAL_MS']);
  return {
    ...(debounceMs !== undefined && { debounceMs }),
    ...(maxWaitMs !== undefined && { maxWaitMs }),
    ...(fetchIntervalMs !== undefined && { fetchIntervalMs }),
  };
}

/** Remote Git: `SMART_TERMINAL_GIT_REMOTE` > `config.md`. */
export function resolveGitRemote(env: NodeJS.ProcessEnv, config: AppConfig | undefined): string | undefined {
  const fromEnv = env['SMART_TERMINAL_GIT_REMOTE'];
  return fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : config?.dataRepoRemote;
}

function configSyncTiming(config: AppConfig | undefined): { debounceMs?: number; maxWaitMs?: number; fetchIntervalMs?: number } {
  return {
    ...(config?.syncDebounceMs !== undefined && { debounceMs: config.syncDebounceMs }),
    ...(config?.syncMaxWaitMs !== undefined && { maxWaitMs: config.syncMaxWaitMs }),
    ...(config?.syncFetchIntervalMs !== undefined && { fetchIntervalMs: config.syncFetchIntervalMs }),
  };
}

interface PrimaryResources {
  search: SearchService;
  git: GitSyncManager;
  clipboard: ClipboardService;
}

/** Clipboard configuration desired by this instance: reapplied when it becomes primary. */
interface ClipboardIntent {
  enabled: boolean;
  paused: boolean;
  activeDirectory: string | null;
}

const isUnavailable = (error: unknown): boolean => error instanceof CoordinatorClientError && error.code === 'COORDINATOR_UNAVAILABLE';

/**
 * Allocator that chooses on every call: local file when this instance is primary, RPC to the primary otherwise.
 * If the primary does not respond (for example, it just died), falls back to the file allocator, which is already safe across processes.
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

/** Orchestrates the coordinator, Git sync, and search in the main process; the role can change at runtime without restarting the window. */
export class CoordinatorRuntime implements ClipboardBackend {
  readonly paths: DataPaths;
  readonly coordinator: Coordinator;
  readonly allocator: SessionIdAllocator;
  private resources: PrimaryResources | undefined;
  private readonly syncListeners = new Set<(status: SyncStatusEvent) => void>();
  private readonly searchRefreshListeners = new Set<(event: SearchRefreshedEvent) => void>();
  private readonly clipboardIntent: ClipboardIntent;
  private lastSyncStatus: SyncStatusEvent = { state: 'offline', remoteConfigured: true };
  private readonly fileAllocator: FileSessionIdAllocator;

  constructor(private readonly options: CoordinatorRuntimeOptions) {
    const env = options.env ?? process.env;
    this.paths = resolveDataPaths(options.userDataPath, env, options.hostname, options.config);
    const clipboardEnv = env['SMART_TERMINAL_CLIPBOARD'];
    this.clipboardIntent = {
      enabled: clipboardEnv !== undefined && clipboardEnv.length > 0 ? clipboardEnv === '1' : (options.config?.clipboardEnabled ?? false),
      paused: false,
      activeDirectory: null,
    };
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

  /** Sync status: local when primary, otherwise RPC `sync.status`. If the primary does not respond, returns the last known state as `offline`. */
  async syncStatus(): Promise<SyncStatusEvent> {
    const git = this.resources?.git;
    if (this.coordinator.isPrimary && git !== undefined) {
      this.lastSyncStatus = { ...git.status, remoteConfigured: git.remoteConfigured };
      return this.lastSyncStatus;
    }
    try {
      const status = await this.coordinator.request<SyncStatusEvent>('sync.status');
      this.lastSyncStatus = status;
      return status;
    } catch {
      return { state: 'offline', remoteConfigured: this.lastSyncStatus.remoteConfigured, ...(this.lastSyncStatus.lastSyncAt !== undefined && { lastSyncAt: this.lastSyncStatus.lastSyncAt }) };
    }
  }

  onSyncStatus(listener: (status: SyncStatusEvent) => void): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  /** Notified after a Git pull changes the index (primary only). */
  onSearchRefreshed(listener: (event: SearchRefreshedEvent) => void): () => void {
    this.searchRefreshListeners.add(listener);
    return () => this.searchRefreshListeners.delete(listener);
  }

  /** Machines present in the index: local when primary, otherwise through RPC. */
  async searchFacets(): Promise<SearchFacetsResult> {
    const resources = this.resources;
    if (this.coordinator.isPrimary && resources !== undefined) {
      return { machines: resources.search.facets() };
    }
    return this.coordinator.request<SearchFacetsResult>('search.facets');
  }

  async clipboardState(): Promise<ClipboardCaptureState> {
    return this.clipboardCall(
      (clipboard) => clipboard.state(),
      () => this.coordinator.request<ClipboardCaptureState>('clipboard.state'),
    );
  }

  async clipboardConfigure(request: ClipboardConfigureRequest): Promise<ClipboardCaptureState> {
    this.clipboardIntent.enabled = request.enabled;
    this.clipboardIntent.paused = request.paused;
    return this.clipboardCall(
      (clipboard) => clipboard.configure(request),
      () => this.coordinator.request<ClipboardCaptureState>('clipboard.configure', { enabled: request.enabled, paused: request.paused }),
    );
  }

  async clipboardSetActive(sessionDirectory: string | null): Promise<ClipboardCaptureState> {
    this.clipboardIntent.activeDirectory = sessionDirectory;
    return this.clipboardCall(
      (clipboard) => clipboard.setActive(sessionDirectory),
      () => this.coordinator.request<ClipboardCaptureState>('clipboard.setActive', { sessionDirectory }),
    );
  }

  async clipboardClear(): Promise<ClipboardCaptureState> {
    return this.clipboardCall(
      (clipboard) => clipboard.clear(),
      () => this.coordinator.request<ClipboardCaptureState>('clipboard.clear'),
    );
  }

  /** Session end: prune active clipboard, update the index, and mark sync dirty (locally or through RPC `session.end`). */
  endSession(sessionDirectory: string): void {
    if (this.clipboardIntent.activeDirectory === sessionDirectory) {
      this.clipboardIntent.activeDirectory = null;
    }
    const resources = this.resources;
    if (this.coordinator.isPrimary && resources !== undefined) {
      resources.clipboard.sessionEnded(sessionDirectory);
      this.notifyWrite(sessionDirectory);
      return;
    }
    void this.coordinator.request('session.end', { sessionDirectory }).catch(() => undefined);
  }

  /** Search: local index when primary, otherwise forwarded to the primary through RPC. */
  async query(request: SearchQueryRequest): Promise<SearchQueryResult> {
    const resources = this.resources;
    if (this.coordinator.isPrimary && resources !== undefined) {
      return resources.search.query(request);
    }
    return this.coordinator.request<SearchQueryResult>('search.query', { ...request });
  }

  /** After this instance writes history/clipboard or ends a session: update the index and notify the primary that sync is dirty. */
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
      .catch(() => undefined); // best effort: the index realigns on refresh and sync on the next cycle
  }

  /**
   * Runs on ClipboardService when primary, otherwise through RPC. If the primary does not respond (takeover in progress), returns
   * this instance's desired state, which is applied when it becomes primary.
   */
  private async clipboardCall(
    local: (clipboard: ClipboardService) => ClipboardCaptureState,
    remote: () => Promise<ClipboardCaptureState>,
  ): Promise<ClipboardCaptureState> {
    const resources = this.resources;
    if (this.coordinator.isPrimary && resources !== undefined) {
      return local(resources.clipboard);
    }
    try {
      const state = await remote();
      this.clipboardIntent.enabled = state.enabled;
      this.clipboardIntent.paused = state.paused;
      return state;
    } catch (error) {
      if (isUnavailable(error)) {
        return { enabled: this.clipboardIntent.enabled, paused: this.clipboardIntent.paused, lastEventAt: null };
      }
      throw error;
    }
  }

  /** Synchronous release of the primary lock for exits that do not go through `before-quit` (for example, `app.exit`). */
  releaseLockSync(): void {
    this.coordinator.releaseLockSync();
  }

  private async createPrimary(env: NodeJS.ProcessEnv): Promise<PrimaryHandle> {
    const search = new SearchService(this.paths.dataRepoPath);
    const notifyRefreshed = (): void => {
      if (search.refresh()) {
        const event: SearchRefreshedEvent = { refreshedAt: new Date().toISOString() };
        for (const listener of this.searchRefreshListeners) listener(event);
      }
    };
    const git = new GitSyncManager({
      repoPath: this.paths.dataRepoPath,
      machine: this.paths.machine,
      remote: resolveGitRemote(env, this.options.config),
      branch: env['SMART_TERMINAL_GIT_BRANCH'] || undefined,
      ...configSyncTiming(this.options.config),
      ...resolveSyncTiming(env),
      // `search.refresh()` is idempotent: it returns true once per change, so no duplicate event.
      onRemoteIntegrated: () => notifyRefreshed(),
      onStatusChange: (status) => {
        if (status.state === 'synced') {
          notifyRefreshed();
        }
        const event: SyncStatusEvent = { ...status, remoteConfigured: git.remoteConfigured };
        this.lastSyncStatus = event;
        for (const listener of this.syncListeners) listener(event);
      },
    });
    const clipboard = new ClipboardService({
      dataRepoPath: this.paths.dataRepoPath,
      source: this.options.clipboardSource,
      ...(this.options.clipboardIntervalMs !== undefined ? { intervalMs: this.options.clipboardIntervalMs } : {}),
      onRecorded: (sessionDirectory) => {
        search.upsertSession(sessionDirectory);
        git.markDirty();
      },
    });
    await git.start();
    this.restoreClipboardIntent(clipboard);
    this.resources = { search, git, clipboard };
    return {
      services: {
        allocate: (request) => this.fileAllocator.allocate(request),
        searchQuery: (query) => search.query({ ...query }).entries,
        searchUpsert: (dir) => search.upsertSession(dir),
        searchRefresh: () => search.refresh(),
        searchFacets: () => search.facets(),
        clipboardState: () => clipboard.state(),
        clipboardConfigure: (config) => clipboard.configure(config),
        clipboardSetActive: (sessionDirectory) => clipboard.setActive(sessionDirectory),
        clipboardClear: () => clipboard.clear(),
        sessionEnd: (sessionDirectory) => {
          clipboard.sessionEnded(sessionDirectory);
          search.upsertSession(sessionDirectory);
          git.markDirty();
        },
        ...git.asServices(),
      },
      stop: async () => {
        this.resources = undefined;
        clipboard.dispose();
        await git.stop();
      },
    };
  }

  /** The new primary resumes capture according to this instance's desired state. */
  private restoreClipboardIntent(clipboard: ClipboardService): void {
    clipboard.configure({ enabled: this.clipboardIntent.enabled, paused: this.clipboardIntent.paused });
    try {
      clipboard.setActive(this.clipboardIntent.activeDirectory);
    } catch {
      this.clipboardIntent.activeDirectory = null;
    }
  }
}
