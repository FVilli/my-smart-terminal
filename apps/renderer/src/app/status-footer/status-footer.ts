import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { syncBadge } from '../session.model';
import { MessageCenter } from '../messages/message-center';

@Component({
  selector: 'app-status-footer',
  imports: [MessageCenter],
  host: { class: 'flex h-footer flex-none items-center justify-between border-t border-line bg-terminal px-3 text-xs leading-normal text-muted' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge group inline-flex items-center gap-1.5" data-testid="sync-badge" [attr.data-state]="badge().state">
      <span class="dot size-2 rounded-full bg-accent group-data-[state=syncing]:bg-syncing group-data-[state=offline]:bg-muted group-data-[state=unconfigured]:bg-muted group-data-[state=error]:bg-danger"></span>{{ badge().label }}
    </span>
    <app-message-center />
    @if (primary()) {
      <span class="primary text-accent" data-testid="primary-indicator" title="Primary instance">★ Primary instance</span>
    }
  `,

})
export class StatusFooter {
  readonly syncState = input<'synced' | 'dirty' | 'syncing' | 'offline' | 'error'>('synced');
  readonly remoteConfigured = input(true);
  readonly primary = input(true);
  protected readonly badge = computed(() => syncBadge(this.syncState(), this.remoteConfigured()));
}
