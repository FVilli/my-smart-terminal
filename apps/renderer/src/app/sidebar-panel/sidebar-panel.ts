import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ClipboardCaptureStore } from '../clipboard-capture/clipboard-capture-store';
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
      <input type="search" data-testid="sidebar-search" [placeholder]="activeTab() === 'clipboard' ? 'Cerca nella clipboard…' : 'Cerca nella cronologia…'" aria-label="Cerca" />
      <select data-testid="sidebar-machine-filter" aria-label="Filtro macchina">
        <option>Tutte le macchine</option>
      </select>
    </div>
    @if (activeTab() === 'clipboard') {
      <div class="capture" data-testid="clipboard-capture">
        <label class="capture-toggle">
          <input
            type="checkbox"
            data-testid="clipboard-enable"
            [checked]="capture.state().enabled"
            (change)="capture.setEnabled($any($event.target).checked)"
          />
          Abilita cattura clipboard
        </label>
        <div class="capture-actions">
          <button type="button" data-testid="clipboard-pause" [disabled]="!capture.state().enabled" (click)="capture.togglePause()">
            {{ capture.state().paused ? 'Riprendi' : 'Pausa' }}
          </button>
          <button type="button" data-testid="clipboard-clear-dedupe" (click)="capture.clearDedupe()">Cancella dedupe</button>
        </div>
        <p class="capture-status" data-testid="clipboard-status">
          {{ capture.statusLabel() }}@if (capture.state().lastEventAt; as last) { · ultimo: {{ last }} }
        </p>
        @if (capture.error()) {
          <p class="capture-error" role="alert" data-testid="clipboard-error">Stato cattura non disponibile.</p>
        }
      </div>
    }
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
    .capture { display: flex; flex-direction: column; gap: 8px; padding: 0 12px 12px; flex: none; min-width: 0; }
    .capture-toggle { display: flex; align-items: center; gap: 8px; color: var(--text); }
    .capture-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .capture-actions button {
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; cursor: pointer; color: var(--text);
    }
    .capture-actions button:disabled { color: var(--text-muted); cursor: default; }
    .capture-status { margin: 0; color: var(--text-muted); font-size: 12px; overflow-wrap: anywhere; }
    .capture-error { margin: 0; color: var(--danger, #e5484d); font-size: 12px; }
    .list { flex: 1 1 0; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 0 12px 12px; }
    .empty { color: var(--text-muted); text-align: center; margin-top: 24px; }
  `,
})
export class SidebarPanel {
  protected readonly capture = inject(ClipboardCaptureStore);
  readonly activeTab = input<SidebarTab>('clipboard');
  readonly tabChange = output<SidebarTab>();
}
