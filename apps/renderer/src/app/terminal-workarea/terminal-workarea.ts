import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-terminal-workarea',
  host: { class: 'relative block min-h-0 min-w-0 flex-1 basis-0 overflow-hidden bg-terminal' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
})
export class TerminalWorkarea {}
