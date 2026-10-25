import type { SessionEnvironment } from '@smart-terminal/contracts';

export type SessionKind = 'local' | 'ssh';
export type SessionStatus = 'starting' | 'running' | 'exited' | 'error';

export interface TerminalSessionView {
  readonly id: string;
  readonly label: string;
  /** Machine/destination shown in the tab (for example, `host/local`). */
  readonly target: string;
  readonly machine: string;
  readonly sessionDirectory: string;
  readonly startedAt: string;
  readonly kind: SessionKind;
  readonly status: SessionStatus;
  readonly pid: number | null;
  readonly exitCode: number | null;
  /** Detected OS/shell context (absent until known, for example while the SSH probe runs). */
  readonly environment?: SessionEnvironment;
}

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';
/** Footer badge state: `unconfigured` when no Git remote exists. */
export type SyncBadgeState = SyncState | 'unconfigured';
export type SidebarTab = 'clipboard' | 'history';

export const SYNC_LABELS: Record<SyncState, string> = {
  synced: 'GitHub synced',
  syncing: 'GitHub syncing…',
  offline: 'GitHub offline',
  error: 'GitHub sync error',
};

export const SYNC_UNCONFIGURED_LABEL = 'Repository not configured';

/** Footer badge derived from the primary state: `dirty` (pending changes) is shown as `syncing`. */
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
