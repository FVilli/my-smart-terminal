import fs from 'node:fs';
import path from 'node:path';
import { SESSIONS_DIRECTORY, SESSION_FILE_NAMES, isValidMachine, parseSessionDirectoryName, resolveSessionDirectory } from './paths';
import { parseClipboardDocument, parseHistoryDocument, parseSessionDocument } from './schema';

export const SEARCH_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const SEARCH_MAX_RESULTS = 100;

export type SearchEntryKind = 'history' | 'clipboard';

export interface SearchEntry {
  /** Stable event id from the Markdown file. */
  id: string;
  machine: string;
  sessionId: string;
  /** Session directory relative to the data repository: `sessions/<machine>/<dir>`. */
  sessionDirectory: string;
  kind: SearchEntryKind;
  /** ISO 8601 with offset. */
  timestamp: string;
  text: string;
  source?: string;
  cwd?: string;
}

export interface SearchQuery {
  /** Case-insensitive substring; empty means filters only. */
  query: string;
  machine?: string;
  sessionId?: string;
  /** ISO 8601, estremo inclusivo. */
  from?: string;
  /** ISO 8601, estremo inclusivo. */
  to?: string;
  kind?: SearchEntryKind;
}

export interface MarkdownSearchIndexOptions {
  dataRepoPath: string;
  maxFileBytes?: number;
}

interface IndexedFile {
  mtimeMs: number;
  size: number;
  entries: SearchEntry[];
}

interface SessionRef {
  relativeDir: string;
  absoluteDir: string;
  machine: string;
}

/**
 * Volatile in-memory index of Markdown files under `sessions/`. No database or watcher:
 * updated by `rebuild()`, `refresh()` (incremental rescan), and `upsertSession()`.
 */
export class MarkdownSearchIndex {
  private readonly sessionsRoot: string;
  private readonly maxFileBytes: number;
  /** Chiave: `<relativeDir>/<history.md|clipboard.md>`. */
  private files = new Map<string, IndexedFile>();

  constructor(private readonly options: MarkdownSearchIndexOptions) {
    this.sessionsRoot = path.join(options.dataRepoPath, SESSIONS_DIRECTORY);
    this.maxFileBytes = options.maxFileBytes ?? SEARCH_MAX_FILE_BYTES;
  }

  get entryCount(): number {
    let count = 0;
    for (const file of this.files.values()) {
      count += file.entries.length;
    }
    return count;
  }

  /** Machines with at least one indexed session, in alphabetical order. */
  machines(): string[] {
    const machines = new Set<string>();
    for (const key of this.files.keys()) {
      const machine = key.split('/')[1];
      if (machine !== undefined) {
        machines.add(machine);
      }
    }
    return [...machines].sort();
  }

  /** Discards everything and rereads from disk. */
  rebuild(): void {
    this.files = new Map();
    this.scan(false);
  }

  /** Incremental rescan: rereads only changed files (mtime/size) and forgets missing files. Returns `true` when the index changed. */
  refresh(): boolean {
    const before = this.signature();
    this.scan(true);
    return this.signature() !== before;
  }

  /** Rereads a session's history/clipboard (data-repository-relative path). Ignores invalid paths. */
  upsertSession(sessionDirectory: string): void {
    let absoluteDir: string;
    try {
      absoluteDir = resolveSessionDirectory(this.options.dataRepoPath, sessionDirectory);
    } catch {
      return;
    }
    const machine = sessionDirectory.split('/')[1] ?? '';
    if (!this.isRealDirectory(absoluteDir)) {
      this.files.delete(`${sessionDirectory}/${SESSION_FILE_NAMES.history}`);
      this.files.delete(`${sessionDirectory}/${SESSION_FILE_NAMES.clipboard}`);
      return;
    }
    this.indexSession({ relativeDir: sessionDirectory, absoluteDir, machine }, false);
  }

  query(request: SearchQuery): SearchEntry[] {
    const needle = request.query.toLowerCase();
    const from = request.from === undefined ? undefined : Date.parse(request.from);
    const to = request.to === undefined ? undefined : Date.parse(request.to);
    const matches: Array<{ time: number; entry: SearchEntry }> = [];
    for (const file of this.files.values()) {
      for (const entry of file.entries) {
        if (
          (request.machine !== undefined && entry.machine !== request.machine) ||
          (request.sessionId !== undefined && entry.sessionId !== request.sessionId) ||
          (request.kind !== undefined && entry.kind !== request.kind) ||
          (needle.length > 0 && !entry.text.toLowerCase().includes(needle))
        ) {
          continue;
        }
        const time = Date.parse(entry.timestamp);
        if ((from !== undefined && time < from) || (to !== undefined && time > to)) {
          continue;
        }
        matches.push({ time, entry });
      }
    }
    matches.sort((a, b) => b.time - a.time);
    return matches.slice(0, SEARCH_MAX_RESULTS).map((match) => match.entry);
  }

  private signature(): string {
    return [...this.files].map(([key, file]) => `${key}:${file.mtimeMs}:${file.size}`).join('|');
  }

  private scan(incremental: boolean): void {
    const seen = new Set<string>();
    for (const session of this.listSessions()) {
      for (const key of this.indexSession(session, incremental)) {
        seen.add(key);
      }
    }
    for (const key of [...this.files.keys()]) {
      if (!seen.has(key)) {
        this.files.delete(key);
      }
    }
  }

  private listSessions(): SessionRef[] {
    const sessions: SessionRef[] = [];
    for (const machine of this.listDirectories(this.sessionsRoot)) {
      if (!isValidMachine(machine)) {
        continue;
      }
      const machineDir = path.join(this.sessionsRoot, machine);
      for (const name of this.listDirectories(machineDir)) {
        if (parseSessionDirectoryName(name) !== null) {
          sessions.push({ relativeDir: `${SESSIONS_DIRECTORY}/${machine}/${name}`, absoluteDir: path.join(machineDir, name), machine });
        }
      }
    }
    return sessions;
  }

  /** Names of real subdirectories (excluding symlinks). */
  private listDirectories(directory: string): string[] {
    try {
      return fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && !dirent.isSymbolicLink())
        .map((dirent) => dirent.name);
    } catch {
      return [];
    }
  }

  /** Indexes a session; returns keys for present files (including files skipped due to errors). */
  private indexSession(session: SessionRef, incremental: boolean): string[] {
    const kinds: Array<{ kind: SearchEntryKind; file: string }> = [
      { kind: 'history', file: SESSION_FILE_NAMES.history },
      { kind: 'clipboard', file: SESSION_FILE_NAMES.clipboard },
    ];
    const keys = kinds.map(({ file }) => `${session.relativeDir}/${file}`);
    let sessionId: string;
    try {
      const sessionFile = this.readableFile(path.join(session.absoluteDir, SESSION_FILE_NAMES.session));
      if (sessionFile === undefined) {
        throw new Error('session.md unreadable');
      }
      const meta = parseSessionDocument(fs.readFileSync(sessionFile.path, 'utf8')).meta;
      if (meta.machine !== session.machine) {
        throw new Error('machine mismatch');
      }
      sessionId = meta.session_id;
    } catch {
      for (const key of keys) {
        this.files.delete(key);
      }
      return keys;
    }
    kinds.forEach(({ kind, file }, index) => {
      const key = keys[index] ?? '';
      const stat = this.readableFile(path.join(session.absoluteDir, file));
      if (stat === undefined) {
        this.files.delete(key);
        return;
      }
      const previous = this.files.get(key);
      if (incremental && previous !== undefined && previous.mtimeMs === stat.mtimeMs && previous.size === stat.size) {
        return;
      }
      try {
        const content = fs.readFileSync(stat.path, 'utf8');
        const entries: SearchEntry[] =
          kind === 'history'
            ? parseHistoryDocument(content).events.map((event) => ({
                id: event.id,
                machine: session.machine,
                sessionId,
                sessionDirectory: session.relativeDir,
                kind,
                timestamp: event.timestamp,
                text: event.text,
                source: event.source,
                ...(event.cwd !== undefined ? { cwd: event.cwd } : {}),
              }))
            : parseClipboardDocument(content).events.map((event) => ({
                id: event.id,
                machine: session.machine,
                sessionId,
                sessionDirectory: session.relativeDir,
                kind,
                timestamp: event.timestamp,
                text: event.text,
                ...(event.source !== undefined ? { source: event.source } : {}),
              }));
        this.files.set(key, { mtimeMs: stat.mtimeMs, size: stat.size, entries });
      } catch {
        this.files.delete(key);
      }
    });
    return keys;
  }

  private isRealDirectory(directory: string): boolean {
    try {
      return fs.lstatSync(directory).isDirectory();
    } catch {
      return false;
    }
  }

  /** Regular file (not a symlink) within the size limit. */
  private readableFile(filePath: string): { path: string; mtimeMs: number; size: number } | undefined {
    try {
      const stat = fs.lstatSync(filePath);
      if (!stat.isFile() || stat.size > this.maxFileBytes) {
        return undefined;
      }
      return { path: filePath, mtimeMs: stat.mtimeMs, size: stat.size };
    } catch {
      return undefined;
    }
  }
}
