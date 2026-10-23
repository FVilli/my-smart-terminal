import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ClipboardCaptureState, ClipboardConfigureRequest, SearchResultEntry } from '@smart-terminal/contracts';
import type { SidebarTab } from '../session.model';

const PREVIEW_MAX_CHARS = 160;

/** Anteprima su una riga: spazi/a capo compressi e testo troncato. */
export function previewText(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_MAX_CHARS ? `${flat.slice(0, PREVIEW_MAX_CHARS)}…` : flat;
}

/** `2026-01-01T10:00:00+02:00` -> `2026-01-01 10:00:00` (ora della macchina di origine). */
export function shortTimestamp(timestamp: string): string {
  return timestamp.slice(0, 19).replace('T', ' ');
}

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
      <input
        type="search"
        data-testid="sidebar-search"
        [placeholder]="activeTab() === 'clipboard' ? 'Search clipboard…' : 'Search history…'"
        aria-label="Search"
        [value]="query()"
        (input)="queryChange.emit($any($event.target).value)"
      />
      <div class="filter-row">
        <select data-testid="sidebar-machine-filter" aria-label="Machine filter" (change)="machineChange.emit($any($event.target).value)">
          <option value="" [selected]="machineFilter() === ''">All machines</option>
          @for (machine of machines(); track machine) {
            <option [value]="machine" [selected]="machine === machineFilter()">{{ machine }}</option>
          }
        </select>
        <button type="button" class="refresh" data-testid="sidebar-refresh" aria-label="Refresh" title="Refresh" (click)="refresh.emit()">↻</button>
      </div>
    </div>
    @if (activeTab() === 'clipboard') {
      <div class="capture" data-testid="clipboard-capture">
        <label class="capture-toggle">
          <input
            type="checkbox"
            data-testid="clipboard-enable"
            [checked]="clipboardState().enabled"
            (change)="configureClipboard.emit({ enabled: $any($event.target).checked, paused: false })"
          />
          Enable clipboard capture
        </label>
        <div class="capture-actions">
          <button
            type="button"
            data-testid="clipboard-pause"
            [disabled]="!clipboardState().enabled"
            (click)="configureClipboard.emit({ enabled: true, paused: !clipboardState().paused })"
          >
            {{ clipboardState().paused ? 'Resume' : 'Pause' }}
          </button>
          <button type="button" data-testid="clipboard-clear-dedupe" (click)="clearClipboard.emit()">Clear dedupe</button>
        </div>
        <p class="capture-status" data-testid="clipboard-status">
          {{ captureLabel() }}@if (clipboardState().lastEventAt; as last) { · last: {{ last }} }
        </p>
        @if (clipboardError()) {
          <p class="capture-error" role="alert" data-testid="clipboard-error">Clipboard capture state unavailable.</p>
        }
      </div>
    }
    @if (notice(); as message) {
      <p class="notice" role="status" data-testid="sidebar-notice">{{ message }}</p>
    }
    <div class="list" data-testid="sidebar-list">
      @if (error()) {
        <p class="error" role="alert" data-testid="sidebar-error">Search unavailable. The terminal is unaffected; try again with ↻.</p>
      }
      @for (entry of entries(); track $index) {
        <article class="entry" data-testid="sidebar-entry" [attr.data-kind]="entry.kind">
          <header class="meta">
            <time data-testid="entry-time">{{ time(entry) }}</time>
            <span class="machine" data-testid="entry-machine">{{ entry.machine }}</span>
            <span data-testid="entry-session">{{ entry.sessionId }}</span>
            @if (entry.source) {
              <span class="source" data-testid="entry-source">{{ entry.source }}</span>
            }
          </header>
          <p class="preview" data-testid="entry-preview" [title]="entry.text">{{ preview(entry) }}</p>
          <div class="entry-actions">
            <button type="button" data-testid="entry-copy" (click)="copyText.emit(entry.text)">Copy</button>
            <button type="button" data-testid="entry-insert" (click)="insertText.emit(entry.text)">Insert</button>
          </div>
        </article>
      } @empty {
        @if (loading()) {
          <p class="empty" data-testid="sidebar-loading">Loading…</p>
        } @else if (!error()) {
          <p class="empty" data-testid="sidebar-empty">{{ emptyMessage() }}</p>
        }
      }
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
    .filter-row { display: flex; gap: 8px; min-width: 0; }
    .filter-row select { flex: 1 1 0; }
    .refresh { flex: none; background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px; padding: 0 10px; cursor: pointer; color: var(--text); }
    .capture { display: flex; flex-direction: column; gap: 8px; padding: 0 12px 12px; flex: none; min-width: 0; }
    .capture-toggle { display: flex; align-items: center; gap: 8px; color: var(--text); }
    .capture-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .capture-actions button, .entry-actions button {
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; cursor: pointer; color: var(--text);
    }
    .capture-actions button:disabled { color: var(--text-muted); cursor: default; }
    .capture-status { margin: 0; color: var(--text-muted); font-size: 12px; overflow-wrap: anywhere; }
    .capture-error, .error { margin: 0 0 8px; color: var(--danger, #e5484d); font-size: 12px; }
    .notice { margin: 0; padding: 0 12px 8px; color: var(--accent); font-size: 12px; flex: none; }
    .list { flex: 1 1 0; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 0 12px 12px; }
    .empty { color: var(--text-muted); text-align: center; margin-top: 24px; }
    .entry { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; min-width: 0; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 8px; font-size: 11px; color: var(--text-muted); overflow-wrap: anywhere; }
    .machine { color: var(--accent); }
    .source { text-transform: uppercase; letter-spacing: 0.04em; }
    .preview { margin: 6px 0; font-family: var(--font-mono); font-size: 12px; overflow-wrap: anywhere; word-break: break-word; }
    .entry-actions { display: flex; gap: 8px; }
    .entry-actions button { padding: 4px 10px; font-size: 12px; }
  `,
})
export class SidebarPanel {
  readonly activeTab = input<SidebarTab>('clipboard');
  readonly query = input('');
  /** Vuoto = tutte le macchine. */
  readonly machineFilter = input('');
  readonly machines = input<readonly string[]>([]);
  readonly entries = input<readonly SearchResultEntry[]>([]);
  readonly loading = input(false);
  readonly error = input(false);
  readonly notice = input<string | null>(null);
  readonly clipboardState = input<ClipboardCaptureState>({ enabled: false, paused: false, lastEventAt: null });
  readonly clipboardError = input(false);

  readonly tabChange = output<SidebarTab>();
  readonly queryChange = output<string>();
  readonly machineChange = output<string>();
  readonly refresh = output<void>();
  readonly copyText = output<string>();
  readonly insertText = output<string>();
  readonly configureClipboard = output<ClipboardConfigureRequest>();
  readonly clearClipboard = output<void>();

  protected captureLabel(): string {
    const { enabled, paused } = this.clipboardState();
    if (!enabled) {
      return 'Clipboard capture off';
    }
    return paused ? 'Clipboard capture paused' : 'Clipboard capture on';
  }

  protected emptyMessage(): string {
    if (this.query().trim().length > 0 || this.machineFilter().length > 0) {
      return 'No results for the current filters.';
    }
    return this.activeTab() === 'clipboard' ? 'No items in the clipboard.' : 'No commands in history.';
  }

  protected time(entry: SearchResultEntry): string {
    return shortTimestamp(entry.timestamp);
  }

  protected preview(entry: SearchResultEntry): string {
    return previewText(entry.text);
  }
}
