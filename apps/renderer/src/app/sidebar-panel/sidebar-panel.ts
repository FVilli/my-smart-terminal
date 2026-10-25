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
    <div class="sidebar-tabs flex flex-none border-b border-line" role="tablist">
      <button
        type="button"
        role="tab"
        data-testid="sidebar-tab-clipboard"
        class="sidebar-tab"
        [class.is-active]="activeTab() === 'clipboard'"
        [attr.aria-selected]="activeTab() === 'clipboard'"
        (click)="tabChange.emit('clipboard')"
      >
        Clipboard
      </button>
      <button
        type="button"
        role="tab"
        data-testid="sidebar-tab-history"
        class="sidebar-tab"
        [class.is-active]="activeTab() === 'history'"
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
        <button type="button" class="refresh btn h-refresh flex-none py-0" data-testid="sidebar-refresh" aria-label="Refresh" title="Refresh" (click)="refresh.emit()">↻</button>
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
        <p class="capture-status sidebar-status wrap-anywhere" data-testid="clipboard-status">
          {{ captureLabel() }}@if (clipboardState().lastEventAt; as last) { · last: {{ last }} }
        </p>
        @if (clipboardError()) {
          <p class="capture-error m-0 mb-2 text-xs text-danger" role="alert" data-testid="clipboard-error">Clipboard capture state unavailable.</p>
        }
      </div>
    }
    @if (notice(); as message) {
      <p class="notice sidebar-status flex-none px-3 pb-2 text-accent" role="status" data-testid="sidebar-notice">{{ message }}</p>
    }
    <div class="list min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3" data-testid="sidebar-list">
      @if (error()) {
        <p class="error m-0 mb-2 text-xs text-danger" role="alert" data-testid="sidebar-error">Search unavailable. The terminal is unaffected; try again with ↻.</p>
      }
      @for (entry of entries(); track $index) {
        <article class="entry card border-l-2 border-l-transparent hover:border-l-accent" data-testid="sidebar-entry" [attr.data-kind]="entry.kind">
          <header class="meta flex flex-wrap gap-x-2 gap-y-1 text-menu text-muted wrap-anywhere">
            <time data-testid="entry-time">{{ time(entry) }}</time>
            <span class="machine text-accent" data-testid="entry-machine">{{ entry.machine }}</span>
            <span data-testid="entry-session">{{ entry.sessionId }}</span>
            @if (entry.source) {
              <span class="source uppercase tracking-meta" data-testid="entry-source">{{ entry.source }}</span>
            }
          </header>
          <p class="preview sidebar-preview" data-testid="entry-preview" [title]="entry.text">{{ preview(entry) }}</p>
          <div class="entry-actions sidebar-actions flex justify-end gap-1">
            <button type="button" class="icon-btn sidebar-entry-control" data-testid="entry-copy" aria-label="Copy entry" title="Copy" (click)="copyText.emit(entry.text)">
              <svg class="size-icon-xs" viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4H5.5A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
            </button>
            <button type="button" class="icon-btn sidebar-entry-control" data-testid="entry-insert" aria-label="Insert entry" title="Insert" (click)="insertText.emit(entry.text)">
              <svg class="size-icon-xs" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v8m0 0-3-3m3 3 3-3M4 15h12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="icon-btn sidebar-entry-control hover:text-danger" data-testid="entry-delete" aria-label="Delete entry" title="Delete" (click)="removeEntry.emit(entry)">
              <svg class="size-icon-xs" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m-6 0 .7 9.1A1.5 1.5 0 0 0 8.2 16.5h3.6a1.5 1.5 0 0 0 1.5-1.4L14 6M8.5 9v4.5m3-4.5v4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
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
  readonly removeEntry = output<SearchResultEntry>();
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
