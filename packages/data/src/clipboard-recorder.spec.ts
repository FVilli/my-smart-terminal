import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIPBOARD_MAX_TEXT_BYTES, ClipboardRecorder, type ClipboardTimers } from './clipboard-recorder';
import { createSessionDocuments, hashClipboardText, parseClipboardDocument, type SessionMeta } from './schema';

let root: string;
let text: string;
let intervals: Array<{ id: number; callback: () => void; ms: number; cleared: boolean }>;
let ids: number;

const timers: ClipboardTimers = {
  setInterval: (callback, ms) => {
    const entry = { id: intervals.length + 1, callback, ms, cleared: false };
    intervals.push(entry);
    return entry.id;
  },
  clearInterval: (handle) => {
    const entry = intervals.find((candidate) => candidate.id === handle);
    if (entry !== undefined) {
      entry.cleared = true;
    }
  },
};
const liveTimers = () => intervals.filter((entry) => !entry.cleared);

function makeSession(label: string): string {
  const meta: SessionMeta = {
    schema_version: 1,
    session_id: label,
    machine: 'host',
    created_at: '2026-01-01T00:00:00+00:00',
    window_id: 'w',
    kind: 'local',
    cwd_initial: '/tmp',
    started_at: '2026-01-01T00:00:00+00:00',
  };
  const dir = path.join(root, label);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'clipboard.md'), createSessionDocuments(meta).clipboard);
  return path.join(dir, 'clipboard.md');
}

function recorder(onRecorded?: (sessionId: string) => void): ClipboardRecorder {
  return new ClipboardRecorder({
    source: { readText: () => text },
    resolveTarget: (sessionId) =>
      fs.existsSync(path.join(root, sessionId)) ? { clipboardFile: path.join(root, sessionId, 'clipboard.md'), sessionDirectory: `dir/${sessionId}` } : undefined,
    clock: () => new Date(2026, 0, 2, 3, 4, 5),
    newId: () => `c-${(ids += 1)}`,
    timers,
    ...(onRecorded !== undefined ? { onRecorded } : {}),
  });
}
const events = (label: string) => parseClipboardDocument(fs.readFileSync(path.join(root, label, 'clipboard.md'), 'utf8')).events;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-clip-'));
  text = '';
  intervals = [];
  ids = 0;
  makeSession('S1');
  makeSession('S2');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('ClipboardRecorder', () => {
  it('is disabled by default and records nothing', async () => {
    const rec = recorder();
    rec.setActiveSession('S1');
    text = 'hello';
    expect(rec.state()).toMatchObject({ enabled: false, paused: false, polling: false });
    expect(await rec.pollOnce()).toBe('inactive');
    expect(events('S1')).toEqual([]);
    expect(liveTimers()).toHaveLength(0);
  });

  it('records text with sha-256 hash, source and timestamp, and notifies', async () => {
    const onRecorded = vi.fn();
    const rec = recorder(onRecorded);
    rec.configure({ enabled: true, paused: false });
    rec.setActiveSession('S1');
    text = 'hello\nworld';
    expect(await rec.pollOnce()).toBe('recorded');
    const [event] = events('S1');
    expect(event).toMatchObject({ id: 'c-1', type: 'text', source: 'system', text: 'hello\nworld', hash: hashClipboardText('hello\nworld') });
    expect(event?.timestamp).toMatch(/^2026-01-02T03:04:05[+-]\d{2}:\d{2}$/);
    expect(onRecorded).toHaveBeenCalledWith('S1', expect.objectContaining({ sessionDirectory: 'dir/S1' }));
    expect(rec.state().lastEventAt).toBe(event?.timestamp);
  });

  it('polls on a single 800ms timer and stops on pause/disable', async () => {
    const rec = recorder();
    rec.configure({ enabled: true, paused: false });
    rec.configure({ enabled: true, paused: false });
    expect(liveTimers()).toHaveLength(1);
    expect(liveTimers()[0]?.ms).toBe(800);
    rec.configure({ enabled: true, paused: true });
    expect(liveTimers()).toHaveLength(0);
    expect(rec.state()).toMatchObject({ enabled: true, paused: true, polling: false });
    expect(await rec.pollOnce()).toBe('inactive');
    rec.configure({ enabled: true, paused: false });
    expect(liveTimers()).toHaveLength(1);
    expect(intervals).toHaveLength(2);
    rec.configure({ enabled: false, paused: false });
    expect(liveTimers()).toHaveLength(0);
  });

  it('timer callback performs a poll', async () => {
    const rec = recorder();
    rec.configure({ enabled: true, paused: false });
    rec.setActiveSession('S1');
    text = 'via timer';
    liveTimers()[0]?.callback();
    await vi.waitFor(() => expect(events('S1')).toHaveLength(1));
  });

  it('ignores empty, oversize and sensitive text', async () => {
    const rec = recorder();
    rec.configure({ enabled: true, paused: false });
    rec.setActiveSession('S1');
    text = '  \n\t';
    expect(await rec.pollOnce()).toBe('empty');
    text = 'a'.repeat(CLIPBOARD_MAX_TEXT_BYTES + 1);
    expect(await rec.pollOnce()).toBe('oversize');
    text = '€'.repeat(Math.floor(CLIPBOARD_MAX_TEXT_BYTES / 3) + 1);
    expect(await rec.pollOnce()).toBe('oversize');
    text = 'export TOKEN=abc';
    expect(await rec.pollOnce()).toBe('sensitive');
    expect(events('S1')).toEqual([]);
    text = 'a'.repeat(CLIPBOARD_MAX_TEXT_BYTES);
    expect(await rec.pollOnce()).toBe('recorded');
  });

  it('dedupes in memory and against hashes already in the file', async () => {
    const rec = recorder();
    rec.configure({ enabled: true, paused: false });
    rec.setActiveSession('S1');
    text = 'same';
    expect(await rec.pollOnce()).toBe('recorded');
    expect(await rec.pollOnce()).toBe('duplicate');
    text = 'other';
    expect(await rec.pollOnce()).toBe('recorded');
    rec.clearDedupe();
    text = 'same';
    expect(await rec.pollOnce()).toBe('duplicate');
    const restarted = recorder();
    restarted.configure({ enabled: true, paused: false });
    restarted.setActiveSession('S1');
    expect(await restarted.pollOnce()).toBe('duplicate');
    expect(events('S1').map((event) => event.text)).toEqual(['same', 'other']);
  });

  it('dedupes per session and follows the active session', async () => {
    const rec = recorder();
    rec.configure({ enabled: true, paused: false });
    text = 'shared';
    expect(await rec.pollOnce()).toBe('no-session');
    rec.setActiveSession('S1');
    expect(await rec.pollOnce()).toBe('recorded');
    rec.setActiveSession('S2');
    expect(await rec.pollOnce()).toBe('recorded');
    rec.setActiveSession('S1');
    expect(await rec.pollOnce()).toBe('duplicate');
    expect(events('S1')).toHaveLength(1);
    expect(events('S2')).toHaveLength(1);
    rec.setActiveSession('gone');
    expect(await rec.pollOnce()).toBe('no-session');
  });

  it('skips a poll while a slow read is still in flight and drops reads after pause', async () => {
    let release: (value: string) => void = () => undefined;
    const slow = new ClipboardRecorder({
      source: { readText: () => new Promise<string>((resolve) => (release = resolve)) },
      resolveTarget: () => ({ clipboardFile: path.join(root, 'S1', 'clipboard.md'), sessionDirectory: 'dir/S1' }),
      timers,
    });
    slow.configure({ enabled: true, paused: false });
    slow.setActiveSession('S1');
    const first = slow.pollOnce();
    await expect(slow.pollOnce()).resolves.toBe('busy');
    slow.configure({ enabled: true, paused: true });
    release('late');
    await expect(first).resolves.toBe('inactive');
    expect(events('S1')).toEqual([]);
  });

  it('reports errors without throwing when the file is unreadable', async () => {
    const rec = recorder();
    rec.configure({ enabled: true, paused: false });
    rec.setActiveSession('S1');
    text = 'x';
    fs.writeFileSync(path.join(root, 'S1', 'clipboard.md'), 'not markdown');
    expect(await rec.pollOnce()).toBe('error');
  });
});
