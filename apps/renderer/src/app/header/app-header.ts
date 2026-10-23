import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="brand">
        <span class="mark" aria-hidden="true">▮</span>
        <span>Smart Terminal</span>
      </div>
      <span class="hint">Local &amp; SSH sessions · Markdown sync</span>
    </header>
  `,
  styles: `
    :host { display: block; flex: none; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 48px; padding: 0 16px;
      background: var(--sidebar-bg); border-bottom: 1px solid var(--border); }
    .brand { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-weight: 600; letter-spacing: 0.02em; }
    .mark { color: var(--accent); }
    .hint { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: 12px; }
  `,
})
export class AppHeader {}
