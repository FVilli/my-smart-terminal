import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  NgZone,
  type OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { SessionsStore } from './sessions-store';

const TERMINAL_THEME = {
  background: '#171e25',
  foreground: '#e6edf3',
  cursor: '#4cc2a5',
  selectionBackground: '#2c3a4a',
};

@Component({
  selector: 'app-terminal-panel',
  templateUrl: './terminal-panel.html',
  styleUrl: './terminal-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.display]': 'active() ? "block" : "none"',
    'data-testid': 'terminal-panel',
    '[attr.data-session-id]': 'sessionId()',
  },
})
export class TerminalPanel implements OnDestroy {
  readonly sessionId = input.required<string>();
  readonly active = input(false);

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly zone = inject(NgZone);
  private readonly store = inject(SessionsStore);

  protected readonly session = computed(() => this.store.sessions().find((s) => s.id === this.sessionId()) ?? null);

  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private exitAnnounced = false;
  private readonly disposers: Array<() => void> = [];

  constructor() {
    afterNextRender(() => this.start());

    effect(() => {
      if (this.active()) {
        queueMicrotask(() => {
          this.fitAndResize();
          this.terminal?.focus();
        });
      }
    });

    effect(() => {
      const session = this.session();
      if (session?.status === 'exited' && !this.exitAnnounced) {
        this.exitAnnounced = true;
        this.terminal?.write(`\r\n\x1b[90m[Process exited with code ${session.exitCode ?? '?'}]\x1b[0m\r\n`);
      }
    });
  }

  ngOnDestroy(): void {
    for (const dispose of this.disposers.splice(0)) {
      dispose();
    }
    this.resizeObserver?.disconnect();
    this.terminal?.dispose();
    this.terminal = null;
  }

  private start(): void {
    const id = this.sessionId();
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
    this.terminal = terminal;
    this.fitAddon = fitAddon;

    this.disposers.push(this.store.attachOutput(id, (data) => terminal.write(data)));

    const input = terminal.onData((data) => {
      if (this.session()?.status !== 'running') {
        return;
      }
      void window.smartTerminal.writeTerminal({ sessionId: id, data }).catch(() => undefined);
    });
    this.disposers.push(() => input.dispose());

    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => this.fitAndResize());
      this.resizeObserver.observe(this.host().nativeElement);
    });
    this.fitAndResize();
    if (this.active()) {
      terminal.focus();
    }
  }

  private fitAndResize(): void {
    const terminal = this.terminal;
    const hostElement = this.host().nativeElement;
    if (terminal === null || this.fitAddon === null || hostElement.offsetWidth === 0 || hostElement.offsetHeight === 0) {
      return;
    }
    try {
      this.fitAddon.fit();
    } catch {
      return;
    }
    if (this.session()?.status === 'running' && terminal.cols >= 1 && terminal.rows >= 1) {
      void window.smartTerminal
        .resizeTerminal({ sessionId: this.sessionId(), cols: terminal.cols, rows: terminal.rows })
        .catch(() => undefined);
    }
  }
}
