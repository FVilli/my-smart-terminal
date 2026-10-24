import fs from 'node:fs';
import type { SearchQueryRequest, SearchQueryResult, SearchRemoveRequest, SearchRemoveResult } from '@smart-terminal/contracts';
import { MarkdownSearchIndex, removeClipboardEvent, removeHistoryEvent, resolveSessionDirectory, sessionFilePaths, writeFileAtomic } from '@smart-terminal/data';

/** Volatile search index in the main process: rebuilt at startup, updated per session. */
export class SearchService {
  private readonly index: MarkdownSearchIndex;

  constructor(private readonly dataRepoPath: string) {
    this.index = new MarkdownSearchIndex({ dataRepoPath });
    this.index.rebuild();
  }

  query(request: SearchQueryRequest): SearchQueryResult {
    return { entries: this.index.query(request) };
  }

  facets(): string[] {
    return this.index.machines();
  }

  /**
   * Deletes one event from the session's Markdown file. The session directory is validated as
   * `sessions/<machine>/<dir>` before any filesystem access; the file is rewritten atomically.
   */
  remove(request: SearchRemoveRequest): SearchRemoveResult {
    const directory = resolveSessionDirectory(this.dataRepoPath, request.sessionDirectory);
    const files = sessionFilePaths(directory);
    const file = request.kind === 'history' ? files.historyFile : files.clipboardFile;
    const content = fs.readFileSync(file, 'utf8');
    const next = request.kind === 'history' ? removeHistoryEvent(content, request.id) : removeClipboardEvent(content, request.id);
    if (next === null) {
      return { removed: false };
    }
    writeFileAtomic(file, next);
    this.upsertSession(request.sessionDirectory);
    return { removed: true };
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
