import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SettingsStore } from '../settings/settings-store';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="brand">
        <span class="mark" aria-hidden="true">▮</span>
        <span>Smart Terminal</span>
      </div>
      <div class="actions">
        <span class="hint">Local &amp; SSH sessions · Markdown sync</span>
        <button type="button" class="settings" data-testid="settings-open" aria-label="Settings" title="Settings" (click)="settings.openSettings()">⚙</button>
      </div>
    </header>
  `,
  styles: `
    :host { display: block; flex: none; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 48px; padding: 0 16px;
      background: var(--sidebar-bg); border-bottom: 1px solid var(--border); }
    .brand { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-weight: 600; letter-spacing: 0.02em; }
    .mark { color: var(--accent); }
    .hint { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: 12px; }
    .actions { display: inline-flex; align-items: center; gap: 12px; min-width: 0; }
    .settings { width: 30px; height: 30px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 16px; }
    .settings:hover, .settings:focus-visible { border-color: var(--border); color: var(--text); outline: none; }
  `,
})
export class AppHeader {
  protected readonly settings = inject(SettingsStore);
}
