import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseClipboardDocument } from '@smart-terminal/data';
import { ClipboardService } from './clipboard-service';
import { DataRuntime } from './data-runtime';
import { validateClipboardConfigure, validateClipboardSetActive } from './ipc';

let root: string;
let runtime: DataRuntime;
let sessions: Map<string, string>;
let clipboardText: string;

beforeEach(async () => {
  vi.useFakeTimers();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-clipsvc-'));
  runtime = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: { SMART_TERMINAL_DATA_REPO: path.join(root, 'repo'), SMART_TERMINAL_MACHINE: 'host' } });
  sessions = new Map();
  for (const window of ['w1', 'w2']) {
    const { allocation } = await runtime.createSession(window, { kind: 'local', cwd: '/tmp' });
    sessions.set(`${window === 'w1' ? 1 : 2}:${allocation.sessionId}`, allocation.relativeDir);
  }
  clipboardText = '';
});
afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(root, { recursive: true, force: true });
});

function service(initiallyEnabled = false, onRecorded?: (dir: string) => void): ClipboardService {
  return new ClipboardService({
    dataRepoPath: runtime.dataRepoPath,
    source: { readText: () => clipboardText },
    resolveSession: (senderId, sessionId) => {
      const sessionDirectory = sessions.get(`${senderId}:${sessionId}`);
      return sessionDirectory === undefined ? undefined : { sessionDirectory };
    },
    initiallyEnabled,
    ...(onRecorded !== undefined ? { onRecorded } : {}),
  });
}
const eventsOf = (key: string) =>
  parseClipboardDocument(fs.readFileSync(path.join(runtime.dataRepoPath, sessions.get(key) ?? '', 'clipboard.md'), 'utf8')).events;

describe('ClipboardService', () => {
  it('is disabled by default and enabled by explicit opt-in', () => {
    expect(service().state()).toEqual({ enabled: false, paused: false, lastEventAt: null });
    const enabled = service(true);
    expect(enabled.state().enabled).toBe(true);
    enabled.dispose();
  });

  it('records into the active session of the sender on the 800ms poll, then pauses', async () => {
    const onRecorded = vi.fn();
    const svc = service(false, onRecorded);
    svc.setActive(1, { sessionId: 'S1' });
    svc.configure({ enabled: true, paused: false });
    clipboardText = 'copied text';
    await vi.advanceTimersByTimeAsync(800);
    expect(eventsOf('1:S1').map((e) => e.text)).toEqual(['copied text']);
    expect(onRecorded).toHaveBeenCalledWith(sessions.get('1:S1'));
    expect(svc.state().lastEventAt).not.toBeNull();

    svc.configure({ enabled: true, paused: true });
    clipboardText = 'while paused';
    await vi.advanceTimersByTimeAsync(2000);
    expect(eventsOf('1:S1')).toHaveLength(1);
    expect(svc.state()).toMatchObject({ enabled: true, paused: true });
    svc.dispose();
  });

  it('ignores set-active for sessions of another window and stops when disabled', async () => {
    const svc = service();
    svc.configure({ enabled: true, paused: false });
    svc.setActive(1, { sessionId: 'S2' });
    clipboardText = 'x1';
    await vi.advanceTimersByTimeAsync(800);
    expect(eventsOf('2:S2')).toEqual([]);
    svc.setActive(2, { sessionId: 'S2' });
    await vi.advanceTimersByTimeAsync(800);
    expect(eventsOf('2:S2')).toHaveLength(1);
    svc.configure({ enabled: false, paused: false });
    clipboardText = 'x2';
    await vi.advanceTimersByTimeAsync(2000);
    expect(eventsOf('2:S2')).toHaveLength(1);
  });
});

describe('clipboard validators', () => {
  it('validate exact shapes', () => {
    expect(validateClipboardConfigure([{ enabled: true, paused: false }])).toBe(true);
    expect(validateClipboardConfigure([{ enabled: true }])).toBe(false);
    expect(validateClipboardConfigure([{ enabled: 'yes', paused: false }])).toBe(false);
    expect(validateClipboardConfigure([{ enabled: true, paused: false, extra: 1 }])).toBe(false);
    expect(validateClipboardSetActive([{ sessionId: null }])).toBe(true);
    expect(validateClipboardSetActive([{ sessionId: 'S1' }])).toBe(true);
    expect(validateClipboardSetActive([{ sessionId: '' }])).toBe(false);
    expect(validateClipboardSetActive([{}])).toBe(false);
  });
});
