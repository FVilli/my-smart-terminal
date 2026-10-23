import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { HISTORY_MAX_AGENT_LENGTH, HISTORY_MAX_TEXT_BYTES, type HistoryRecordRequest, type HistoryRecordResult } from '@smart-terminal/contracts';
import {
  appendHistoryEvent,
  formatIsoWithOffset,
  isSensitiveText,
  parseSessionDocument,
  resolveSessionDirectory,
  sessionFilePaths,
  writeFileAtomic,
} from '@smart-terminal/data';

export interface HistorySessionRef {
  /** Session directory relative to the data repository: `sessions/<machine>/<dir>`. */
  sessionDirectory: string;
}

export interface HistoryServiceOptions {
  dataRepoPath: string;
  /** Resolves the session belonging to window `senderId`; `undefined` when it does not exist. */
  resolveSession(senderId: number, sessionId: string): HistorySessionRef | undefined;
  clock?: () => Date;
  newId?: () => string;
  /** Notified after a successful write (for example, a search-index update). */
  onRecorded?(sessionDirectory: string): void;
}

export class HistoryError extends Error {
  constructor(readonly code: 'HISTORY_SESSION_NOT_FOUND' | 'HISTORY_WRITE_FAILED' | 'HISTORY_INVALID_REQUEST') {
    super(code);
    this.name = 'HistoryError';
  }
}

/** Records only explicit submissions from the assisted editor (source `assisted`). */
export class HistoryService {
  private readonly clock: () => Date;
  private readonly newId: () => string;

  constructor(private readonly options: HistoryServiceOptions) {
    this.clock = options.clock ?? (() => new Date());
    this.newId = options.newId ?? randomUUID;
  }

  record(senderId: number, request: HistoryRecordRequest): HistoryRecordResult {
    if (
      request.text.trim().length === 0 ||
      Buffer.byteLength(request.text, 'utf8') > HISTORY_MAX_TEXT_BYTES ||
      (request.agent !== undefined && (request.agent.length === 0 || request.agent.length > HISTORY_MAX_AGENT_LENGTH || /[\r\n]/.test(request.agent)))
    ) {
      throw new HistoryError('HISTORY_INVALID_REQUEST');
    }
    const session = this.options.resolveSession(senderId, request.sessionId);
    if (session === undefined) {
      throw new HistoryError('HISTORY_SESSION_NOT_FOUND');
    }
    if (isSensitiveText(request.text)) {
      return { recorded: false };
    }
    try {
      const files = sessionFilePaths(resolveSessionDirectory(this.options.dataRepoPath, session.sessionDirectory));
      const cwd = parseSessionDocument(fs.readFileSync(files.sessionFile, 'utf8')).meta.cwd_initial;
      const current = fs.readFileSync(files.historyFile, 'utf8');
      const next = appendHistoryEvent(current, {
        id: this.newId(),
        timestamp: formatIsoWithOffset(this.clock()),
        source: 'assisted',
        ...(request.agent !== undefined ? { agent: request.agent } : {}),
        ...(/[\r\n]/.test(cwd) ? {} : { cwd }),
        text: request.text,
      });
      if (next !== current) {
        writeFileAtomic(files.historyFile, next);
      }
    } catch {
      throw new HistoryError('HISTORY_WRITE_FAILED');
    }
    this.options.onRecorded?.(session.sessionDirectory);
    return { recorded: true };
  }
}
