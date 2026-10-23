import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { formatIsoWithOffset } from './paths';
import { isSensitiveText } from './secret-filter';
import { appendClipboardEvent, hashClipboardText, parseClipboardDocument, writeFileAtomic } from './schema';

export const CLIPBOARD_POLL_INTERVAL_MS = 800;
export const CLIPBOARD_MAX_TEXT_BYTES = 32 * 1024;
export const CLIPBOARD_EVENT_SOURCE = 'system';

export interface ClipboardTextSource {
  /** Current system clipboard text (empty when the content is not text). */
  readText(): string | Promise<string>;
}

export interface ClipboardTarget {
  clipboardFile: string;
  /** Opaque identifier passed to `onRecorded` (for example, a session-relative directory). */
  sessionDirectory: string;
}

export interface ClipboardTimers {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface ClipboardRecorderOptions {
  source: ClipboardTextSource;
  /** Resolves the session's clipboard.md file; `undefined` when the session is no longer valid. */
  resolveTarget(sessionId: string): ClipboardTarget | undefined;
  clock?: () => Date;
  newId?: () => string;
  timers?: ClipboardTimers;
  intervalMs?: number;
  onRecorded?(sessionId: string, target: ClipboardTarget): void;
}

export interface ClipboardRecorderState {
  enabled: boolean;
  paused: boolean;
  polling: boolean;
  activeSessionId: string | null;
  /** ISO 8601 timestamp of the last written event. */
  lastEventAt: string | null;
}

export type PollOutcome = 'busy' | 'inactive' | 'no-session' | 'empty' | 'oversize' | 'sensitive' | 'duplicate' | 'recorded' | 'error';

const defaultTimers: ClipboardTimers = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

/**
 * Opt-in capture of clipboard text in the active session. One timer per instance;
 * deduplication per session (memory plus hashes already present in clipboard.md).
 */
export class ClipboardRecorder {
  private enabled = false;
  private paused = false;
  private activeSessionId: string | null = null;
  private timer: unknown;
  private polling = false;
  private lastEventAt: string | null = null;
  private readonly seenHashes = new Map<string, Set<string>>();
  private readonly clock: () => Date;
  private readonly newId: () => string;
  private readonly timers: ClipboardTimers;
  private readonly intervalMs: number;

  constructor(private readonly options: ClipboardRecorderOptions) {
    this.clock = options.clock ?? (() => new Date());
    this.newId = options.newId ?? randomUUID;
    this.timers = options.timers ?? defaultTimers;
    this.intervalMs = options.intervalMs ?? CLIPBOARD_POLL_INTERVAL_MS;
  }

  configure(config: { enabled: boolean; paused: boolean }): ClipboardRecorderState {
    this.enabled = config.enabled;
    this.paused = config.paused;
    this.syncTimer();
    return this.state();
  }

  setActiveSession(sessionId: string | null): void {
    this.activeSessionId = sessionId;
  }

  /** Forgets in-memory hashes (entries already written to the file remain deduplicated). */
  clearDedupe(): void {
    this.seenHashes.clear();
  }

  state(): ClipboardRecorderState {
    return {
      enabled: this.enabled,
      paused: this.paused,
      polling: this.timer !== undefined,
      activeSessionId: this.activeSessionId,
      lastEventAt: this.lastEventAt,
    };
  }

  dispose(): void {
    this.enabled = false;
    this.syncTimer();
  }

  /** Only one poll at a time: returns `busy` when a read is still in progress. */
  async pollOnce(): Promise<PollOutcome> {
    if (!this.enabled || this.paused) {
      return 'inactive';
    }
    const sessionId = this.activeSessionId;
    if (sessionId === null) {
      return 'no-session';
    }
    if (this.polling) {
      return 'busy';
    }
    this.polling = true;
    try {
      const text = await this.options.source.readText();
      if (!this.enabled || this.paused || this.activeSessionId !== sessionId) {
        return 'inactive';
      }
      if (text.trim().length === 0) {
        return 'empty';
      }
      if (Buffer.byteLength(text, 'utf8') > CLIPBOARD_MAX_TEXT_BYTES) {
        return 'oversize';
      }
      if (isSensitiveText(text)) {
        return 'sensitive';
      }
      const hash = hashClipboardText(text);
      let seen = this.seenHashes.get(sessionId);
      if (seen?.has(hash)) {
        return 'duplicate';
      }
      const target = this.options.resolveTarget(sessionId);
      if (target === undefined) {
        return 'no-session';
      }
      const current = fs.readFileSync(target.clipboardFile, 'utf8');
      if (seen === undefined) {
        seen = new Set(parseClipboardDocument(current).events.map((event) => event.hash));
        this.seenHashes.set(sessionId, seen);
      }
      if (seen.has(hash)) {
        return 'duplicate';
      }
      const timestamp = formatIsoWithOffset(this.clock());
      const next = appendClipboardEvent(current, { id: this.newId(), timestamp, type: 'text', source: CLIPBOARD_EVENT_SOURCE, hash, text });
      if (next === current) {
        return 'duplicate';
      }
      writeFileAtomic(target.clipboardFile, next);
      seen.add(hash);
      this.lastEventAt = timestamp;
      this.options.onRecorded?.(sessionId, target);
      return 'recorded';
    } catch {
      return 'error';
    } finally {
      this.polling = false;
    }
  }

  private syncTimer(): void {
    const shouldPoll = this.enabled && !this.paused;
    if (shouldPoll && this.timer === undefined) {
      this.timer = this.timers.setInterval(() => void this.pollOnce(), this.intervalMs);
    } else if (!shouldPoll && this.timer !== undefined) {
      this.timers.clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
