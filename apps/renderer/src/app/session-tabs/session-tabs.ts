import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { TerminalSessionView } from '../session.model';

@Component({
  selector: 'app-session-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" aria-label="Sessioni terminale">
      @for (session of sessions(); track session.id) {
        <div
          class="tab"
          role="tab"
          [class.tab--active]="session.id === activeId()"
          [class.tab--exited]="session.status === 'exited' || session.status === 'error'"
          [attr.aria-selected]="session.id === activeId()"
          data-testid="session-tab"
          [attr.data-session-id]="session.id"
          tabindex="0"
          (click)="selected.emit(session.id)"
          (keydown.enter)="selected.emit(session.id)"
        >
          <span class="tab-label">{{ session.label }}</span>
          <span class="tab-target">{{ session.target }}</span>
          <button
            type="button"
            class="tab-close"
            data-testid="session-tab-close"
            [attr.data-session-id]="session.id"
            [attr.aria-label]="'Chiudi ' + session.label"
            (click)="$event.stopPropagation(); closed.emit(session.id)"
          >
            ×
          </button>
        </div>
      }
      <div class="plus-wrap">
        <button
          type="button"
          class="plus"
          data-testid="session-plus"
          aria-label="Nuova sessione"
          aria-haspopup="menu"
          [attr.aria-expanded]="menuOpen()"
          (click)="menuOpen.set(!menuOpen())"
        >
          +
        </button>
        @if (menuOpen()) {
          <div class="menu" role="menu">
            <button
              type="button"
              role="menuitem"
              data-testid="session-new-local"
              (click)="menuOpen.set(false); createLocal.emit()"
            >
              Local
            </button>
            <button type="button" role="menuitem" data-testid="session-new-ssh" disabled>
              SSH <small>Disponibile in M05</small>
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; background: var(--tab-bg); border-bottom: 1px solid var(--border); }
    .tabs { display: flex; align-items: stretch; height: 40px; min-width: 0; }
    .tab {
      display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 220px; padding: 0 8px 0 14px;
      border-right: 1px solid var(--border); color: var(--text-muted); cursor: pointer; white-space: nowrap;
    }
    .tab--active { background: var(--terminal-bg); color: var(--text); box-shadow: inset 0 -2px 0 var(--accent); }
    .tab--exited .tab-label { text-decoration: line-through; }
    .tab-label { font-weight: 600; }
    .tab-target { font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
    button { background: none; border: 0; cursor: pointer; }
    .tab-close { color: var(--text-muted); border-radius: 4px; width: 20px; height: 20px; line-height: 1; }
    .tab-close:hover { background: var(--border); color: var(--text); }
    .plus-wrap { position: relative; display: flex; }
    .plus { width: 40px; font-size: 20px; color: var(--text-muted); }
    .plus:hover { color: var(--accent); }
    .menu {
      position: absolute; top: 100%; left: 0; z-index: 10; min-width: 220px; display: flex; flex-direction: column;
      background: var(--tab-bg); border: 1px solid var(--border); border-radius: 6px; padding: 4px;
    }
    .menu button { text-align: left; padding: 8px 10px; border-radius: 4px; }
    .menu button:hover:not(:disabled) { background: var(--border); }
    .menu button:disabled { color: var(--text-muted); cursor: not-allowed; }
    small { margin-left: 6px; color: var(--text-muted); }
  `,
})
export class SessionTabs {
  readonly sessions = input.required<readonly TerminalSessionView[]>();
  readonly activeId = input<string | null>(null);
  readonly selected = output<string>();
  readonly closed = output<string>();
  readonly createLocal = output<void>();

  protected readonly menuOpen = signal(false);
}
