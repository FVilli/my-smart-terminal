import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ClipboardCaptureState, ClipboardConfigureRequest, SearchResultEntry } from '@smart-terminal/contracts';
import type { SidebarTab } from '../session.model';

const PREVIEW_MAX_CHARS = 160;

/** One-line preview: whitespace is collapsed and text is truncated. */
export function previewText(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_MAX_CHARS ? `${flat.slice(0, PREVIEW_MAX_CHARS)}…` : flat;
}

/** `2026-01-01T10:00:00+02:00` -> `2026-01-01 10:00:00` (time on the originating machine). */
export function shortTimestamp(timestamp: string): string {
  return timestamp.slice(0, 19).replace('T', ' ');
}

@Component({
  selector: 'app-sidebar-panel',
  host: { class: 'flex h-full min-h-0 min-w-0 flex-col bg-sidebar' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs flex flex-none border-b border-line" role="tablist">
      <button
        type="button"
        role="tab"
        data-testid="sidebar-tab-clipboard"
        class="flex-1 cursor-pointer border-0 bg-transparent px-3 py-3 text-muted"
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
        class="flex-1 cursor-pointer border-0 bg-transparent px-3 py-3 text-muted"
        [class.active]="activeTab() === 'history'"
        [attr.aria-selected]="activeTab() === 'history'"
        (click)="tabChange.emit('history')"
      >
        History
      </button>
    </div>
    <div class="filters flex flex-none flex-col gap-2 p-3">
      <input
        class="field"
        type="search"
        data-testid="sidebar-search"
        [placeholder]="activeTab() === 'clipboard' ? 'Search clipboard…' : 'Search history…'"
        aria-label="Search"
        [value]="query()"
        (input)="queryChange.emit($any($event.target).value)"
      />
      <div class="filter-row flex min-w-0 gap-2">
        <select class="field flex-1 basis-0" data-testid="sidebar-machine-filter" aria-label="Machine filter" (change)="machineChange.emit($any($event.target).value)">
          <option value="" [selected]="machineFilter() === ''">All machines</option>
          @for (machine of machines(); track machine) {
            <option [value]="machine" [selected]="machine === machineFilter()">{{ machine }}</option>
          }
        </select>
        <button type="button" class="refresh btn flex-none px-2.5 py-0" data-testid="sidebar-refresh" aria-label="Refresh" title="Refresh" (click)="refresh.emit()">↻</button>
      </div>
    </div>
    @if (activeTab() === 'clipboard') {
      <div class="capture flex min-w-0 flex-none flex-col gap-2 px-3 pb-3" data-testid="clipboard-capture">
        <label class="capture-toggle flex items-center gap-2 text-fg">
          <input
            type="checkbox"
            data-testid="clipboard-enable"
            [checked]="clipboardState().enabled"
            (change)="configureClipboard.emit({ enabled: $any($event.target).checked, paused: false })"
          />
          Enable clipboard capture
        </label>
        <div class="capture-actions flex flex-wrap gap-2">
          <button
            type="button"
            class="btn"
            data-testid="clipboard-pause"
            [disabled]="!clipboardState().enabled"
            (click)="configureClipboard.emit({ enabled: true, paused: !clipboardState().paused })"
          >
            {{ clipboardState().paused ? 'Resume' : 'Pause' }}
          </button>
          <button type="button" class="btn" data-testid="clipboard-clear-dedupe" (click)="clearClipboard.emit()">Clear dedupe</button>
        </div>
        <p class="capture-status m-0 wrap-anywhere text-xs leading-[normal] text-muted" data-testid="clipboard-status">
          {{ captureLabel() }}@if (clipboardState().lastEventAt; as last) { · last: {{ last }} }
        </p>
        @if (clipboardError()) {
          <p class="capture-error m-0 mb-2 text-xs text-danger" role="alert" data-testid="clipboard-error">Clipboard capture state unavailable.</p>
        }
      </div>
    }
    @if (notice(); as message) {
      <p class="notice m-0 flex-none px-3 pb-2 text-xs leading-[normal] text-accent" role="status" data-testid="sidebar-notice">{{ message }}</p>
    }
    <div class="list min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3" data-testid="sidebar-list">
      @if (error()) {
        <p class="error m-0 mb-2 text-xs text-danger" role="alert" data-testid="sidebar-error">Search unavailable. The terminal is unaffected; try again with ↻.</p>
      }
      @for (entry of entries(); track $index) {
        <article class="entry card border-l-2 border-l-transparent hover:border-l-accent" data-testid="sidebar-entry" [attr.data-kind]="entry.kind">
          <header class="meta flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted wrap-anywhere">
            <time data-testid="entry-time">{{ time(entry) }}</time>
            <span class="machine text-accent" data-testid="entry-machine">{{ entry.machine }}</span>
            <span data-testid="entry-session">{{ entry.sessionId }}</span>
            @if (entry.source) {
              <span class="source uppercase tracking-[.04em]" data-testid="entry-source">{{ entry.source }}</span>
            }
          </header>
          <p class="preview my-1.5 font-mono text-xs leading-[normal] wrap-anywhere" data-testid="entry-preview" [title]="entry.text">{{ preview(entry) }}</p>
          <div class="entry-actions flex gap-2">
            <button type="button" class="btn px-2.5 py-1 text-xs leading-[normal]" data-testid="entry-copy" (click)="copyText.emit(entry.text)">Copy</button>
            <button type="button" class="btn px-2.5 py-1 text-xs leading-[normal]" data-testid="entry-insert" (click)="insertText.emit(entry.text)">Insert</button>
          </div>
        </article>
      } @empty {
        @if (loading()) {
          <p class="empty mt-6 text-center text-muted" data-testid="sidebar-loading">Loading…</p>
        } @else if (!error()) {
          <p class="empty mt-6 text-center text-muted" data-testid="sidebar-empty">{{ emptyMessage() }}</p>
        }
      }
    </div>
  `,
  styles: `
    /* Active tab state depends on an Angular class binding. */
    .tabs button.active { color: var(--text); box-shadow: inset 0 -2px 0 var(--accent); }
  `,
})
export class SidebarPanel {
  readonly activeTab = input<SidebarTab>('clipboard');
  readonly query = input('');
  /** Empty = all machines. */
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
