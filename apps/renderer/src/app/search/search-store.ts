import { Injectable, signal } from '@angular/core';
import type { SearchQueryRequest, SearchResultEntry, SmartTerminalApi } from '@smart-terminal/contracts';
import type { SidebarTab } from '../session.model';

export const SEARCH_DEBOUNCE_MS = 200;
export const SEARCH_REFRESH_INTERVAL_MS = 15_000;
const NOTICE_MS = 2_000;

/** Ricerca globale della sidebar (History/Clipboard di tutte le macchine). Gli errori non toccano mai i terminali. */
@Injectable({ providedIn: 'root' })
export class SearchStore {
  private readonly api: SmartTerminalApi = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  private readonly tabState = signal<SidebarTab>('clipboard');
  private readonly queryState = signal('');
  private readonly machineState = signal('');
  private readonly machinesState = signal<readonly string[]>([]);
  private readonly entriesState = signal<readonly SearchResultEntry[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal(false);
  private readonly noticeState = signal<string | null>(null);
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  private intervalTimer: ReturnType<typeof setInterval> | undefined;
  private requestSeq = 0;

  readonly tab = this.tabState.asReadonly();
  readonly query = this.queryState.asReadonly();
  /** Vuoto = tutte le macchine. */
  readonly machineFilter = this.machineState.asReadonly();
  readonly machines = this.machinesState.asReadonly();
  readonly entries = this.entriesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Esito dell'ultima copia, mostrato per qualche secondo. */
  readonly notice = this.noticeState.asReadonly();

  constructor() {
    this.api.onSearchRefreshed(() => this.refresh());
  }

  /** Primo caricamento e refresh periodico (ogni 15 s). */
  start(): void {
    this.refresh();
    this.intervalTimer ??= setInterval(() => this.refresh(), SEARCH_REFRESH_INTERVAL_MS);
  }

  stop(): void {
    clearInterval(this.intervalTimer);
    this.intervalTimer = undefined;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = undefined;
  }

  setTab(tab: SidebarTab): void {
    if (tab !== this.tabState()) {
      this.tabState.set(tab);
      this.entriesState.set([]);
    }
    this.refresh();
  }

  /** Query case-insensitive con debounce di 200 ms. */
  setQuery(query: string): void {
    this.queryState.set(query);
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.loadEntries();
    }, SEARCH_DEBOUNCE_MS);
  }

  setMachine(machine: string): void {
    this.machineState.set(machine);
    this.refresh();
  }

  /** Ricarica subito voci e macchine (focus, evento sync, pulsante Aggiorna). */
  refresh(): void {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = undefined;
    void this.loadEntries();
    void this.loadFacets();
  }

  async copy(text: string): Promise<void> {
    try {
      await this.api.clipboardWrite({ text });
      this.showNotice('Copiato negli appunti');
    } catch {
      this.showNotice('Copia non riuscita');
    }
  }

  private showNotice(message: string): void {
    this.noticeState.set(message);
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.noticeState.set(null), NOTICE_MS);
  }

  private buildRequest(): SearchQueryRequest {
    const machine = this.machineState();
    return {
      query: this.queryState().trim(),
      kind: this.tabState() === 'history' ? 'history' : 'clipboard',
      ...(machine.length > 0 ? { machine } : {}),
    };
  }

  private async loadEntries(): Promise<void> {
    const seq = ++this.requestSeq;
    this.loadingState.set(true);
    try {
      const result = await this.api.search(this.buildRequest());
      if (seq === this.requestSeq) {
        this.entriesState.set(result.entries);
        this.errorState.set(false);
      }
    } catch {
      if (seq === this.requestSeq) {
        this.errorState.set(true);
      }
    } finally {
      if (seq === this.requestSeq) {
        this.loadingState.set(false);
      }
    }
  }

  private async loadFacets(): Promise<void> {
    try {
      this.machinesState.set((await this.api.searchFacets()).machines);
    } catch {
      // le macchine restano quelle note: l'errore di ricerca e' gia' segnalato da loadEntries
    }
  }
}
