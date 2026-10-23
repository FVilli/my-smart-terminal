import { Injectable, computed, signal } from '@angular/core';
import type {
  SmartTerminalApi,
  TerminalDataEvent,
  TerminalExitEvent,
} from '@smart-terminal/contracts';
import { TERMINAL_MAX_WRITE_BYTES } from '@smart-terminal/contracts';
import type { TerminalSessionView } from './session.model';

const MAX_BUFFERED_CHARS = 1_000_000;

/** Stato delle sessioni terminale della finestra (solo in memoria, nessuna persistenza). */
@Injectable({ providedIn: 'root' })
export class SessionsStore {
  private readonly api: SmartTerminalApi = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  private readonly sessionsState = signal<readonly TerminalSessionView[]>([]);
  private readonly activeIdState = signal<string | null>(null);
  private readonly draftsState = signal<ReadonlyMap<string, string>>(new Map());
  private readonly createErrorState = signal<string | null>(null);
  private readonly creatingState = signal(false);

  /** Output ricevuto prima che il pannello si agganci (la create risponde dopo i primi dati). */
  private readonly buffers = new Map<string, string[]>();
  private readonly outputListeners = new Map<string, (data: string) => void>();

  readonly sessions = this.sessionsState.asReadonly();
  readonly activeId = this.activeIdState.asReadonly();
  readonly createError = this.createErrorState.asReadonly();
  readonly creating = this.creatingState.asReadonly();
  readonly activeSession = computed(
    () => this.sessionsState().find((session) => session.id === this.activeIdState()) ?? null,
  );
  readonly activeDraft = computed(() => {
    const id = this.activeIdState();
    return id === null ? '' : (this.draftsState().get(id) ?? '');
  });

  constructor() {
    this.api.onTerminalData((event) => this.handleData(event));
    this.api.onTerminalExit((event) => this.handleExit(event));
  }

  async createLocal(): Promise<string | null> {
    this.creatingState.set(true);
    this.createErrorState.set(null);
    try {
      const info = await this.api.createTerminal({ kind: 'local', cols: 80, rows: 24 });
      const session: TerminalSessionView = {
        id: info.sessionId,
        label: info.label,
        target: `${info.machine}/local`,
        machine: info.machine,
        sessionDirectory: info.sessionDirectory,
        startedAt: info.startedAt,
        kind: 'local',
        status: 'running',
        pid: info.pid,
        exitCode: null,
      };
      this.sessionsState.update((list) => [...list, session]);
      this.activeIdState.set(session.id);
      return session.id;
    } catch {
      this.createErrorState.set('Impossibile avviare la shell locale.');
      return null;
    } finally {
      this.creatingState.set(false);
    }
  }

  select(id: string): void {
    if (this.sessionsState().some((session) => session.id === id)) {
      this.activeIdState.set(id);
    }
  }

  /** Chiude il PTY (se ancora vivo) e rimuove il tab; attiva il tab adiacente se era quello attivo. */
  close(id: string): void {
    const list = this.sessionsState();
    const index = list.findIndex((session) => session.id === id);
    if (index < 0) {
      return;
    }
    const closing = list[index]!;
    const remaining = list.filter((session) => session.id !== id);
    this.sessionsState.set(remaining);
    if (this.activeIdState() === id) {
      this.activeIdState.set(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
    }
    this.draftsState.update((drafts) => {
      const next = new Map(drafts);
      next.delete(id);
      return next;
    });
    this.buffers.delete(id);
    this.outputListeners.delete(id);
    if (closing.status !== 'exited') {
      void this.api.closeTerminal({ sessionId: id }).catch(() => undefined);
    }
  }

  setDraft(id: string, text: string): void {
    this.draftsState.update((drafts) => new Map(drafts).set(id, text));
  }

  /** Invia la bozza alla sessione attiva (aggiunge `\r` se manca); svuota la bozza solo a invio riuscito. */
  async sendActive(text: string): Promise<boolean> {
    const session = this.activeSession();
    if (session === null || session.status !== 'running' || text.length === 0) {
      return false;
    }
    const data = text.endsWith('\r') || text.endsWith('\n') ? text : `${text}\r`;
    if (new TextEncoder().encode(data).length > TERMINAL_MAX_WRITE_BYTES) {
      return false;
    }
    try {
      await this.api.writeTerminal({ sessionId: session.id, data });
    } catch {
      return false;
    }
    if (this.sessionsState().some((s) => s.id === session.id)) {
      this.setDraft(session.id, '');
    }
    return true;
  }

  markExited(id: string, exitCode: number | null): void {
    this.sessionsState.update((list) =>
      list.map((session) => (session.id === id ? { ...session, status: 'exited', exitCode } : session)),
    );
  }

  /** Aggancia il pannello all'output della sessione: rilascia il buffer iniziale, poi inoltra in diretta. */
  attachOutput(id: string, listener: (data: string) => void): () => void {
    for (const chunk of this.buffers.get(id) ?? []) {
      listener(chunk);
    }
    this.buffers.delete(id);
    this.outputListeners.set(id, listener);
    return () => {
      if (this.outputListeners.get(id) === listener) {
        this.outputListeners.delete(id);
      }
    };
  }

  private handleData(event: TerminalDataEvent): void {
    const listener = this.outputListeners.get(event.sessionId);
    if (listener) {
      listener(event.data);
      return;
    }
    const chunks = this.buffers.get(event.sessionId) ?? [];
    chunks.push(event.data);
    while (chunks.length > 1 && chunks.reduce((sum, chunk) => sum + chunk.length, 0) > MAX_BUFFERED_CHARS) {
      chunks.shift();
    }
    this.buffers.set(event.sessionId, chunks);
  }

  private handleExit(event: TerminalExitEvent): void {
    if (this.sessionsState().some((session) => session.id === event.sessionId)) {
      this.markExited(event.sessionId, event.exitCode);
    }
  }
}
