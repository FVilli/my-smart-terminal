import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SyncState } from '../session.model';

const SYNC_LABELS: Record<SyncState, string> = {
  synced: 'GitHub synced',
  syncing: 'GitHub syncing…',
  offline: 'GitHub offline',
  error: 'GitHub sync error',
};

@Component({
  selector: 'app-status-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" data-testid="sync-badge" [attr.data-state]="syncState()">
      <span class="dot"></span>{{ syncLabel() }}
    </span>
    @if (primary()) {
      <span class="primary" data-testid="primary-indicator" title="Primary instance">★ Primary instance</span>
    }
  `,
  styles: `
    :host { display: flex; flex: none; align-items: center; justify-content: space-between; height: 28px; padding: 0 12px;
      background: var(--tab-bg); border-top: 1px solid var(--border); font-size: 12px; color: var(--text-muted); }
    .badge { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
    [data-state='syncing'] .dot { background: #e3b341; }
    [data-state='offline'] .dot { background: var(--text-muted); }
    [data-state='error'] .dot { background: var(--danger); }
    .primary { color: var(--accent); }
  `,
})
export class StatusFooter {
  readonly syncState = input<SyncState>('synced');
  readonly primary = input(true);
  protected readonly syncLabel = computed(() => SYNC_LABELS[this.syncState()]);
}
