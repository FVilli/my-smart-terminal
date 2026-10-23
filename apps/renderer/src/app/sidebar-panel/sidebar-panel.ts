import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { SidebarTab } from '../session.model';

@Component({
  selector: 'app-sidebar-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist">
      <button
        type="button"
        role="tab"
        data-testid="sidebar-tab-clipboard"
        [class.active]="activeTab() === 'clipboard'"
        [attr.aria-selected]="activeTab() === 'clipboard'"
        (click)="tabChange.emit('clipboard')"
      >
        Clipboard
      </button>
      <button
        type="button"
        role="tab"
        data-testid="sidebar-tab-history"
        [class.active]="activeTab() === 'history'"
        [attr.aria-selected]="activeTab() === 'history'"
        (click)="tabChange.emit('history')"
      >
        History
      </button>
    </div>
    <div class="filters">
      <input type="search" data-testid="sidebar-search" placeholder="Cerca…" aria-label="Cerca" disabled />
      <select data-testid="sidebar-machine-filter" aria-label="Filtro macchina" disabled>
        <option>Tutte le macchine</option>
      </select>
    </div>
    <div class="list" data-testid="sidebar-list">
      <p class="empty">{{ activeTab() === 'clipboard' ? 'Nessun elemento nella clipboard.' : 'Nessun comando in cronologia.' }}</p>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-width: 0; min-height: 0; height: 100%; background: var(--sidebar-bg); }
    .tabs { display: flex; flex: none; border-bottom: 1px solid var(--border); }
    .tabs button { flex: 1; padding: 12px; background: none; border: 0; color: var(--text-muted); cursor: pointer; }
    .tabs button.active { color: var(--text); box-shadow: inset 0 -2px 0 var(--accent); }
    .filters { display: flex; flex-direction: column; gap: 8px; padding: 12px; flex: none; }
    .filters input, .filters select {
      min-width: 0; width: 100%; background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px;
    }
    .list { flex: 1 1 0; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 0 12px 12px; }
    .empty { color: var(--text-muted); text-align: center; margin-top: 24px; }
  `,
})
export class SidebarPanel {
  readonly activeTab = input<SidebarTab>('clipboard');
  readonly tabChange = output<SidebarTab>();
}
