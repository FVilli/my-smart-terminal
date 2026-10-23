import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_MAX_TEXT_BYTES } from '@smart-terminal/contracts';
import { parseHistoryDocument } from '@smart-terminal/data';
import { DataRuntime } from './data-runtime';
import { HistoryService } from './history-service';
import { validateHistoryRecord } from './ipc';

let root: string;
let runtime: DataRuntime;
let sessionDirectory: string;
let historyFile: string;
let ids: number;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-history-'));
  runtime = new DataRuntime({
    userDataPath: path.join(root, 'ud'),
    env: { SMART_TERMINAL_DATA_REPO: path.join(root, 'repo'), SMART_TERMINAL_MACHINE: 'host' },
    clock: () => new Date(2026, 9, 22, 9, 5, 3),
  });
  const { allocation } = await runtime.createSession('win', { kind: 'local', cwd: '/home/u' });
  sessionDirectory = allocation.relativeDir;
  historyFile = allocation.historyFile;
  ids = 0;
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function service(onRecorded?: (dir: string) => void): HistoryService {
  return new HistoryService({
    dataRepoPath: runtime.dataRepoPath,
    resolveSession: (senderId, sessionId) => (senderId === 1 && sessionId === 'S1' ? { sessionDirectory } : undefined),
    clock: () => new Date(2026, 9, 22, 10, 0, 0),
    newId: () => `evt-${(ids += 1)}`,
    ...(onRecorded !== undefined ? { onRecorded } : {}),
  });
}
const events = () => parseHistoryDocument(fs.readFileSync(historyFile, 'utf8')).events;

describe('HistoryService', () => {
  it('appends an assisted event with cwd from session.md and optional agent', () => {
    const onRecorded = vi.fn();
    const history = service(onRecorded);
    expect(history.record(1, { sessionId: 'S1', text: 'ls -la\necho "x"' })).toEqual({ recorded: true });
    expect(history.record(1, { sessionId: 'S1', text: 'git status', agent: 'codex' })).toEqual({ recorded: true });
    const [first, second] = events();
    expect(first).toMatchObject({ id: 'evt-1', source: 'assisted', cwd: '/home/u', text: 'ls -la\necho "x"' });
    expect(first?.agent).toBeUndefined();
    expect(first?.timestamp).toMatch(/^2026-10-22T10:00:00[+-]\d{2}:\d{2}$/);
    expect(second).toMatchObject({ id: 'evt-2', agent: 'codex' });
    expect(onRecorded).toHaveBeenCalledWith(sessionDirectory);
  });

  it('does not write sensitive text', () => {
    const before = fs.readFileSync(historyFile, 'utf8');
    const onRecorded = vi.fn();
    expect(service(onRecorded).record(1, { sessionId: 'S1', text: 'export API_KEY=abc123' })).toEqual({ recorded: false });
    expect(fs.readFileSync(historyFile, 'utf8')).toBe(before);
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('is idempotent for a repeated event id', () => {
    const history = new HistoryService({
      dataRepoPath: runtime.dataRepoPath,
      resolveSession: () => ({ sessionDirectory }),
      newId: () => 'same-id',
    });
    history.record(1, { sessionId: 'S1', text: 'a' });
    history.record(1, { sessionId: 'S1', text: 'b' });
    expect(events()).toHaveLength(1);
  });

  it('rejects unknown sessions, oversize text and invalid agent with sanitized codes', () => {
    const history = service();
    expect(() => history.record(2, { sessionId: 'S1', text: 'x' })).toThrow('HISTORY_SESSION_NOT_FOUND');
    expect(() => history.record(1, { sessionId: 'S9', text: 'x' })).toThrow('HISTORY_SESSION_NOT_FOUND');
    expect(() => history.record(1, { sessionId: 'S1', text: 'a'.repeat(HISTORY_MAX_TEXT_BYTES + 1) })).toThrow('HISTORY_INVALID_REQUEST');
    expect(() => history.record(1, { sessionId: 'S1', text: 'x', agent: 'a'.repeat(65) })).toThrow('HISTORY_INVALID_REQUEST');
    expect(events()).toHaveLength(0);
    fs.rmSync(historyFile);
    expect(() => history.record(1, { sessionId: 'S1', text: 'x' })).toThrow(/^HISTORY_WRITE_FAILED$/);
  });
});

describe('validateHistoryRecord', () => {
  it('accepts exact shape and rejects extras, source overrides and limits', () => {
    expect(validateHistoryRecord([{ sessionId: 'S1', text: 'ls' }])).toBe(true);
    expect(validateHistoryRecord([{ sessionId: 'S1', text: 'ls', agent: 'x' }])).toBe(true);
    expect(validateHistoryRecord([{ sessionId: 'S1', text: 'ls', source: 'shell' }])).toBe(false);
    expect(validateHistoryRecord([{ sessionId: 'S1', text: '   ' }])).toBe(false);
    expect(validateHistoryRecord([{ sessionId: 'S1', text: 'a'.repeat(HISTORY_MAX_TEXT_BYTES + 1) }])).toBe(false);
    expect(validateHistoryRecord([{ sessionId: 'S1', text: 'a'.repeat(HISTORY_MAX_TEXT_BYTES) }])).toBe(true);
    expect(validateHistoryRecord([{ sessionId: 'S1', text: 'x', agent: 'a'.repeat(65) }])).toBe(false);
    expect(validateHistoryRecord([{ sessionId: 1, text: 'x' }])).toBe(false);
    expect(validateHistoryRecord([])).toBe(false);
  });
});
