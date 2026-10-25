import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { TerminalSessionView } from '../session.model';

@Component({
  selector: 'app-session-tabs',
  host: { class: 'block border-b border-line bg-tab' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs flex h-[37px] min-w-0 items-stretch" role="tablist" aria-label="Terminal sessions">
      @for (session of sessions(); track session.id) {
        <div
          class="tab session-tab group flex min-w-0 max-w-tab cursor-pointer items-center gap-2 whitespace-nowrap border-r border-line pl-4 pr-2 text-muted"
          role="tab"
          [class.is-active]="session.id === activeId()"
          [class.tab--exited]="session.status === 'exited' || session.status === 'error'"
          [attr.aria-selected]="session.id === activeId()"
          data-testid="session-tab"
          [attr.data-session-id]="session.id"
          tabindex="0"
          (click)="selected.emit(session.id)"
          (keydown.enter)="selected.emit(session.id)"
        >
          <span class="tab-label font-semibold group-[.tab--exited]:line-through">{{ session.label }}</span>
          <span class="tab-target truncate text-xs leading-[normal]">{{ session.target }}</span>
          <button
            type="button"
            class="tab-close icon-btn h-5 w-5 leading-none"
            data-testid="session-tab-close"
            [attr.data-session-id]="session.id"
            [attr.aria-label]="'Close ' + session.label"
            (click)="$event.stopPropagation(); closed.emit(session.id)"
          >
            ×
          </button>
        </div>
      }
      <div class="plus-wrap relative flex">
        <button
          type="button"
          class="plus h-[38px] w-[38px] cursor-pointer border-0 bg-transparent text-xl leading-[normal] text-muted hover:text-accent"
          data-testid="session-plus"
          aria-label="New session"
          aria-haspopup="menu"
          [attr.aria-expanded]="menuOpen()"
          (click)="toggleMenu()"
        >
          +
        </button>
        @if (menuOpen()) {
          <div class="menu absolute left-0 top-full z-10 flex min-w-[220px] flex-col rounded-md border border-line bg-tab p-1" role="menu">
            <button
              type="button"
              role="menuitem"
              class="menu-item"
              data-testid="session-new-local"
              (click)="menuOpen.set(false); createLocal.emit()"
            >
              Local
            </button>
            @for (alias of sshAliases(); track alias) {
              <button
                type="button"
                role="menuitem"
                class="menu-item"
                data-testid="session-new-ssh"
                [attr.data-alias]="alias"
                (click)="menuOpen.set(false); createSsh.emit(alias)"
              >
                <span class="menu-kind inline-block text-xs font-semibold uppercase leading-[1.2] tracking-[.06em]">SSH</span><small class="ml-1.5 text-[10px] font-normal text-muted">{{ alias }}</small>
              </button>
            } @empty {
              <button type="button" role="menuitem" class="menu-item" data-testid="session-new-ssh" disabled>
                <span class="menu-kind inline-block text-xs font-semibold uppercase leading-[1.2] tracking-[.06em]">SSH</span><small class="ml-1.5 text-[10px] font-normal text-muted">No hosts in ~/.ssh/config</small>
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class SessionTabs {
  readonly sessions = input.required<readonly TerminalSessionView[]>();
  readonly activeId = input<string | null>(null);
  readonly selected = output<string>();
  readonly closed = output<string>();
  readonly createLocal = output<void>();
  readonly createSsh = output<string>();
  /** Alias `Host` letti da `~/.ssh/config`. */
  readonly sshAliases = input<readonly string[]>([]);
  /** The `+` menu was opened: the parent rereads the aliases. */
  readonly menuOpened = output<void>();

  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    const opening = !this.menuOpen();
    this.menuOpen.set(opening);
    if (opening) {
      this.menuOpened.emit();
    }
  }
}
