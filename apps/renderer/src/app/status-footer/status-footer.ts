import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { syncBadge } from '../session.model';

@Component({
  selector: 'app-status-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" data-testid="sync-badge" [attr.data-state]="badge().state">
      <span class="dot"></span>{{ badge().label }}
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
    [data-state='offline'] .dot, [data-state='unconfigured'] .dot { background: var(--text-muted); }
    [data-state='error'] .dot { background: var(--danger); }
    .primary { color: var(--accent); }
  `,
})
export class StatusFooter {
  readonly syncState = input<'synced' | 'dirty' | 'syncing' | 'offline' | 'error'>('synced');
  readonly remoteConfigured = input(true);
  readonly primary = input(true);
  protected readonly badge = computed(() => syncBadge(this.syncState(), this.remoteConfigured()));
}
