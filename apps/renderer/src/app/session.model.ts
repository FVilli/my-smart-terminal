export type SessionKind = 'local' | 'ssh';
export type SessionStatus = 'starting' | 'running' | 'exited' | 'error';

export interface TerminalSessionView {
  readonly id: string;
  readonly label: string;
  /** Macchina/destinazione mostrata nel tab (es. `host/local`). */
  readonly target: string;
  readonly machine: string;
  readonly sessionDirectory: string;
  readonly startedAt: string;
  readonly kind: SessionKind;
  readonly status: SessionStatus;
  readonly pid: number | null;
  readonly exitCode: number | null;
}

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';
/** Stato del badge nel footer: `unconfigured` quando non esiste un remote Git. */
export type SyncBadgeState = SyncState | 'unconfigured';
export type SidebarTab = 'clipboard' | 'history';

export const SYNC_LABELS: Record<SyncState, string> = {
  synced: 'GitHub synced',
  syncing: 'GitHub syncing…',
  offline: 'GitHub offline',
  error: 'GitHub sync error',
};

export const SYNC_UNCONFIGURED_LABEL = 'Repository not configured';

/** Badge del footer dallo stato del primary: `dirty` (modifiche in attesa) e' mostrato come `syncing`. */
export function syncBadge(
  state: 'synced' | 'dirty' | 'syncing' | 'offline' | 'error',
  remoteConfigured: boolean,
): { state: SyncBadgeState; label: string } {
  if (!remoteConfigured) {
    return { state: 'unconfigured', label: SYNC_UNCONFIGURED_LABEL };
  }
  const normalized: SyncState = state === 'dirty' ? 'syncing' : state;
  return { state: normalized, label: SYNC_LABELS[normalized] };
}
