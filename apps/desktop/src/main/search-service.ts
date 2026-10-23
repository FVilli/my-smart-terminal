import type { SearchQueryRequest, SearchQueryResult } from '@smart-terminal/contracts';
import { MarkdownSearchIndex } from '@smart-terminal/data';

/** Indice di ricerca volatile del main process: ricostruito all'avvio, aggiornato per sessione. */
export class SearchService {
  private readonly index: MarkdownSearchIndex;

  constructor(dataRepoPath: string) {
    this.index = new MarkdownSearchIndex({ dataRepoPath });
    this.index.rebuild();
  }

  query(request: SearchQueryRequest): SearchQueryResult {
    return { entries: this.index.query(request) };
  }

  /** Dopo una scrittura history/clipboard o a fine sessione. Gli errori non devono interrompere il chiamante. */
  upsertSession(sessionDirectory: string): void {
    try {
      this.index.upsertSession(sessionDirectory);
    } catch {
      // l'indice e' ricostruibile da disco: un fallimento non e' bloccante
    }
  }

  /** Rescan incrementale, da usare dopo un pull Git (M04). */
  refresh(): void {
    this.index.refresh();
  }
}
