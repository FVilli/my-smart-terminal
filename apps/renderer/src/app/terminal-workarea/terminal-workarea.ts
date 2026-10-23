import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-terminal-workarea',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styles: `
    :host { position: relative; display: block; flex: 1 1 0; min-height: 0; min-width: 0; overflow: hidden; background: var(--terminal-bg); }
  `,
})
export class TerminalWorkarea {}
