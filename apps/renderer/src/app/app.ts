import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TerminalPanel } from './terminal-panel';

@Component({
  selector: 'app-root',
  imports: [TerminalPanel],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
