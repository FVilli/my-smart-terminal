import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { SidebarTab } from '../session.model';
import { LayoutStore } from '../layout-store';
import { SearchStore } from '../search/search-store';
import { SettingsStore } from '../settings/settings-store';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header" (dblclick)="toggleMaximize()">
      <img class="icon" src="/icon.png" alt="" />
      <div class="title" data-testid="header-version">Smart Terminal - Version {{ version() }}</div>
      <div class="actions">
        <button type="button" class="toggle" [class.active]="layout.panel() === 'history'" [attr.aria-pressed]="layout.panel() === 'history'" data-testid="header-history" title="History" (click)="toggle('history')">History</button>
        <button type="button" class="toggle" [class.active]="layout.panel() === 'clipboard'" [attr.aria-pressed]="layout.panel() === 'clipboard'" data-testid="header-clipboard" title="Clipboard" (click)="toggle('clipboard')">Clipboard</button>
        <button type="button" class="settings" data-testid="settings-open" aria-label="Settings" title="Settings" (click)="settings.openSettings()">⚙</button>
        @if (showControls()) {
          <div class="window-controls">
            <button type="button" data-testid="window-minimize" aria-label="Minimize" title="Minimize" (click)="windowControl('minimize', $event)">_</button>
            <button type="button" data-testid="window-maximize" [attr.aria-label]="maximized() ? 'Restore' : 'Maximize'" [title]="maximized() ? 'Restore' : 'Maximize'" (click)="windowControl('toggle-maximize', $event)">{{ maximized() ? '❐' : '□' }}</button>
            <button type="button" data-testid="window-close" aria-label="Close" title="Close" (click)="windowControl('close', $event)">×</button>
          </div>
        }
      </div>
    </header>
  `,
  styles: `
    :host { display: block; flex: none; }
    .header { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 35px; flex: none; padding: 0 8px; background: var(--terminal-bg); border-bottom: 1px solid var(--border); -webkit-app-region: drag; }
    .icon { width: 18px; height: 18px; object-fit: contain; }
    .title { position: absolute; left: 50%; transform: translateX(-50%); max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
    .actions, .window-controls { display: inline-flex; align-items: center; gap: 4px; min-width: 0; -webkit-app-region: no-drag; }
    .toggle { height: 22px; padding: 0 6px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 11px; }
    .toggle.active { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
    .toggle:focus-visible, .settings:focus-visible, .window-controls button:focus-visible { outline: 2px solid var(--accent); }
    .settings { width: 30px; height: 30px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 16px; }
    .settings:hover, .settings:focus-visible { border-color: var(--border); color: var(--text); outline: none; }
    .window-controls button { width: 38px; height: 35px; margin: -1px 0; border: 0; background: transparent; color: var(--text); cursor: pointer; font-size: 15px; }
    .window-controls button:last-child:hover { background: #c42b1c; color: white; }
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

  protected toggle(tab: SidebarTab): void {
    const next = this.layout.panel() === tab ? null : tab;
    this.layout.set(next);
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
