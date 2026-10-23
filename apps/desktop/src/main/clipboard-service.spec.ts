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
let directories: string[];
let clipboardText: string;

beforeEach(async () => {
  vi.useFakeTimers();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-clipsvc-'));
  runtime = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: { SMART_TERMINAL_DATA_REPO: path.join(root, 'repo'), SMART_TERMINAL_MACHINE: 'host' } });
  directories = [];
  for (const window of ['w1', 'w2']) {
    const { allocation } = await runtime.createSession(window, { kind: 'local', cwd: '/tmp' });
    directories.push(allocation.relativeDir);
  }
  clipboardText = '';
});
afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(root, { recursive: true, force: true });
});

function service(onRecorded?: (dir: string) => void): ClipboardService {
  return new ClipboardService({
    dataRepoPath: runtime.dataRepoPath,
    source: { readText: () => clipboardText },
    ...(onRecorded !== undefined ? { onRecorded } : {}),
  });
}
const eventsOf = (index: number) =>
  parseClipboardDocument(fs.readFileSync(path.join(runtime.dataRepoPath, directories[index] ?? '', 'clipboard.md'), 'utf8')).events;

describe('ClipboardService', () => {
  it('is disabled by default and starts polling only when enabled', () => {
    const svc = service();
    expect(svc.state()).toEqual({ enabled: false, paused: false, lastEventAt: null });
    expect(svc.polling).toBe(false);
    svc.configure({ enabled: true, paused: false });
    expect(svc.polling).toBe(true);
    svc.dispose();
    expect(svc.polling).toBe(false);
  });

  it('records into the active session directory on the 800ms poll, then pauses', async () => {
    const onRecorded = vi.fn();
    const svc = service(onRecorded);
    svc.setActive(directories[0] ?? '');
    svc.configure({ enabled: true, paused: false });
    clipboardText = 'copied text';
    await vi.advanceTimersByTimeAsync(800);
    expect(eventsOf(0).map((e) => e.text)).toEqual(['copied text']);
    expect(onRecorded).toHaveBeenCalledWith(directories[0]);
    expect(svc.state().lastEventAt).not.toBeNull();

    svc.configure({ enabled: true, paused: true });
    clipboardText = 'while paused';
    await vi.advanceTimersByTimeAsync(2000);
    expect(eventsOf(0)).toHaveLength(1);
    expect(svc.state()).toMatchObject({ enabled: true, paused: true });
    svc.dispose();
  });

  it('rejects directories outside the data repo and keeps the previous target', async () => {
    const svc = service();
    for (const bad of ['../etc', '/etc/passwd', 'sessions/host', 'sessions/host/../../x', 'sessions/host/not-a-session']) {
      expect(() => svc.setActive(bad)).toThrow();
    }
    svc.configure({ enabled: true, paused: false });
    clipboardText = 'x1';
    await vi.advanceTimersByTimeAsync(800);
    expect(eventsOf(0)).toEqual([]);
    svc.setActive(directories[1] ?? '');
    await vi.advanceTimersByTimeAsync(800);
    expect(eventsOf(1)).toHaveLength(1);
    svc.configure({ enabled: false, paused: false });
    clipboardText = 'x2';
    await vi.advanceTimersByTimeAsync(2000);
    expect(eventsOf(1)).toHaveLength(1);
  });

  it('stops writing to a session that ended', async () => {
    const svc = service();
    svc.configure({ enabled: true, paused: false });
    svc.setActive(directories[0] ?? '');
    svc.sessionEnded(directories[0] ?? '');
    clipboardText = 'after end';
    await vi.advanceTimersByTimeAsync(1600);
    expect(eventsOf(0)).toEqual([]);
    svc.dispose();
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
