export type SessionKind = 'local' | 'ssh';
export type SessionStatus = 'starting' | 'running' | 'exited' | 'error';

export interface TerminalSessionView {
  readonly id: string;
  readonly label: string;
  readonly target: string;
  readonly kind: SessionKind;
  readonly status: SessionStatus;
  readonly pid: number | null;
  readonly exitCode: number | null;
}

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';
export type SidebarTab = 'clipboard' | 'history';

export const SYNC_LABELS: Record<SyncState, string> = {
  synced: 'GitHub synced',
  syncing: 'GitHub syncing…',
  offline: 'GitHub offline',
  error: 'GitHub sync error',
};
