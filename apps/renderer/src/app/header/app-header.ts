import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LayoutStore } from '../layout-store';
import { SearchStore } from '../search/search-store';
import { SettingsStore } from '../settings/settings-store';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block flex-none' },
  template: `
    <header class="header relative flex h-header flex-none items-center justify-between gap-2 border-b border-line bg-terminal px-2" (dblclick)="toggleMaximize()">
      <img class="icon h-[18px] w-[18px] object-contain" src="/icon.png" alt="" />
      <div class="title absolute left-1/2 max-w-[45%] -translate-x-1/2 truncate text-xs leading-[normal]" data-testid="header-version">Smart Terminal - Version {{ version() }}</div>
      <div class="actions inline-flex min-w-0 items-center gap-1">
        <button type="button" class="toggle inline-flex h-[26px] w-[30px] cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent p-1 text-muted focus-visible:outline-2 focus-visible:outline-accent" [class.active]="layout.panel() !== null" [attr.aria-pressed]="layout.panel() !== null" data-testid="header-panel-toggle" [attr.title]="layout.panel() === null ? 'Show side panel' : 'Hide side panel'" [attr.aria-label]="layout.panel() === null ? 'Show side panel' : 'Hide side panel'" (click)="toggle()">
          <svg class="h-[18px] w-[18px]" viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3" width="15" height="14" rx="1.5" fill="none" stroke="currentColor"/><path d="M12.5 3v14" [attr.fill]="layout.panel() !== null ? 'currentColor' : 'none'" [attr.stroke]="layout.panel() !== null ? 'currentColor' : 'none'"/></svg>
        </button>
        <button type="button" class="settings h-[30px] w-[30px] cursor-pointer rounded-md border border-transparent bg-transparent text-base leading-[normal] text-muted hover:border-line hover:text-fg focus-visible:border-line focus-visible:text-fg focus-visible:outline-none" data-testid="settings-open" aria-label="Settings" title="Settings" (click)="settings.openSettings()">⚙</button>
        @if (showControls()) {
          <div class="window-controls inline-flex min-w-0 items-center gap-1">
            <button type="button" class="-my-px h-header w-[38px] cursor-pointer border-0 bg-transparent text-[15px] text-fg focus-visible:outline-2 focus-visible:outline-accent" data-testid="window-minimize" aria-label="Minimize" title="Minimize" (click)="windowControl('minimize', $event)">_</button>
            <button type="button" class="-my-px h-header w-[38px] cursor-pointer border-0 bg-transparent text-[15px] text-fg focus-visible:outline-2 focus-visible:outline-accent" data-testid="window-maximize" [attr.aria-label]="maximized() ? 'Restore' : 'Maximize'" [title]="maximized() ? 'Restore' : 'Maximize'" (click)="windowControl('toggle-maximize', $event)">{{ maximized() ? '❐' : '□' }}</button>
            <button type="button" class="-my-px h-header w-[38px] cursor-pointer border-0 bg-transparent text-[15px] text-fg hover:bg-danger-strong hover:text-white focus-visible:outline-2 focus-visible:outline-accent" data-testid="window-close" aria-label="Close" title="Close" (click)="windowControl('close', $event)">×</button>
          </div>
        }
      </div>
    </header>
  `,
  styles: `
    /* Only what utilities cannot express: native window drag regions and the
       active-state wash that depends on an Angular class binding. */
    .header { -webkit-app-region: drag; }
    .actions, .window-controls { -webkit-app-region: no-drag; }
    .toggle.active { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
  `,
})
export class AppHeader {
  protected readonly settings = inject(SettingsStore);
  protected readonly layout = inject(LayoutStore);
  private readonly search = inject(SearchStore);
  protected readonly version = signal('');
  protected readonly showControls = signal(false);
  protected readonly maximized = signal(false);

  constructor() {
    void window.smartTerminal.runtimeInfo().then((info) => {
      this.version.set(info.appVersion);
      this.showControls.set(info.platform !== 'darwin');
    });
    window.smartTerminal.onWindowMaximized(({ maximized }) => this.maximized.set(maximized));
  }

  protected toggle(): void {
    this.layout.toggle();
    const next = this.layout.panel();
    if (next !== null) this.search.setTab(next);
  }

  protected windowControl(action: 'minimize' | 'toggle-maximize' | 'close', event: Event): void {
    event.stopPropagation();
    void window.smartTerminal.windowControl(action);
  }

  protected toggleMaximize(): void {
    void window.smartTerminal.windowControl('toggle-maximize');
  }
}
