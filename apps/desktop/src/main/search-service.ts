import type { SearchQueryRequest, SearchQueryResult } from '@smart-terminal/contracts';
import { MarkdownSearchIndex } from '@smart-terminal/data';

/** Volatile search index in the main process: rebuilt at startup, updated per session. */
export class SearchService {
  private readonly index: MarkdownSearchIndex;

  constructor(dataRepoPath: string) {
    this.index = new MarkdownSearchIndex({ dataRepoPath });
    this.index.rebuild();
  }

  query(request: SearchQueryRequest): SearchQueryResult {
    return { entries: this.index.query(request) };
  }

  facets(): string[] {
    return this.index.machines();
  }

  /** After a history/clipboard write or session end. Errors must not interrupt the caller. */
  upsertSession(sessionDirectory: string): void {
    try {
      this.index.upsertSession(sessionDirectory);
    } catch {
      // the index can be rebuilt from disk: a failure is non-blocking
    }
  }

  /** Incremental rescan after a Git pull. `true` if the index changed; errors are non-blocking. */
  refresh(): boolean {
    try {
      return this.index.refresh();
    } catch {
      return false;
    }
  }
}
