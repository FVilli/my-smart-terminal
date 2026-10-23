import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  NgZone,
  type OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { TerminalDataEvent, TerminalExitEvent, Unsubscribe } from '@smart-terminal/contracts';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';

const TERMINAL_THEME = {
  background: '#0b0f14',
  foreground: '#e6edf3',
  cursor: '#4cc2a5',
  selectionBackground: '#24313d',
};

@Component({
  selector: 'app-terminal-panel',
  templateUrl: './terminal-panel.html',
  styleUrl: './terminal-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalPanel implements OnDestroy {
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly zone = inject(NgZone);

  protected readonly exited = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private sessionId: string | null = null;
  private destroyed = false;
  private readonly disposers: Array<() => void> = [];
  private pendingData: TerminalDataEvent[] = [];

  constructor() {
    afterNextRender(() => {
      void this.start();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    for (const dispose of this.disposers.splice(0)) {
      dispose();
    }
    this.resizeObserver?.disconnect();
    this.terminal?.dispose();
    this.terminal = null;
    const sessionId = this.sessionId;
    this.sessionId = null;
    if (sessionId !== null && !this.exited()) {
      void window.smartTerminal.closeTerminal({ sessionId }).catch(() => undefined);
    }
  }

  private async start(): Promise<void> {
    const api = window.smartTerminal;
    const terminal = new Terminal({
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace",
      fontSize: 14,
      cursorBlink: true,
      theme: TERMINAL_THEME,
      allowProposedApi: false,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(this.host().nativeElement);
    fitAddon.fit();
    this.terminal = terminal;
    this.fitAddon = fitAddon;

    // Sottoscrizione prima della create: l'output iniziale può precedere la risposta.
    const offData: Unsubscribe = api.onTerminalData((event) => this.handleData(event));
    const offExit: Unsubscribe = api.onTerminalExit((event) => this.handleExit(event));
    this.disposers.push(offData, offExit);

    const input = terminal.onData((data) => {
      const sessionId = this.sessionId;
      if (sessionId === null || this.exited()) {
        return;
      }
      void api.writeTerminal({ sessionId, data }).catch(() => undefined);
    });
    this.disposers.push(() => input.dispose());

    try {
      const info = await api.createTerminal({ kind: 'local', cols: terminal.cols, rows: terminal.rows });
      if (this.destroyed) {
        void api.closeTerminal({ sessionId: info.sessionId }).catch(() => undefined);
        return;
      }
      this.sessionId = info.sessionId;
      const pending = this.pendingData;
      this.pendingData = [];
      pending.forEach((event) => this.handleData(event));
    } catch {
      this.errorMessage.set('Impossibile avviare la shell locale.');
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => this.fitAndResize());
      this.resizeObserver.observe(this.host().nativeElement);
    });
    this.fitAndResize();
    terminal.focus();
  }

  private handleData(event: TerminalDataEvent): void {
    if (this.sessionId === null) {
      this.pendingData.push(event);
      return;
    }
    if (event.sessionId === this.sessionId) {
      this.terminal?.write(event.data);
    }
  }

  private handleExit(event: TerminalExitEvent): void {
    if (event.sessionId !== this.sessionId) {
      return;
    }
    this.exited.set(true);
    this.terminal?.write(`\r\n\x1b[90m[Processo terminato con codice ${event.exitCode}]\x1b[0m\r\n`);
  }

  private fitAndResize(): void {
    const sessionId = this.sessionId;
    const terminal = this.terminal;
    if (this.destroyed || terminal === null || this.fitAddon === null || sessionId === null || this.exited()) {
      return;
    }
    try {
      this.fitAddon.fit();
    } catch {
      return;
    }
    if (terminal.cols >= 1 && terminal.rows >= 1) {
      void window.smartTerminal
        .resizeTerminal({ sessionId, cols: terminal.cols, rows: terminal.rows })
        .catch(() => undefined);
    }
  }
}
