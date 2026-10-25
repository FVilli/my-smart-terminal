import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TerminalDataEvent, TerminalEnvironmentEvent, TerminalExitEvent } from '@smart-terminal/contracts';
import { SYNC_LABELS } from '../apps/renderer/src/app/session.model';
import { SessionsStore } from '../apps/renderer/src/app/sessions-store';

describe('SessionsStore', () => {
  let nextId = 0;
  let emitData: (event: TerminalDataEvent) => void;
  let emitExit: (event: TerminalExitEvent) => void;
  let emitEnvironment: (event: TerminalEnvironmentEvent) => void;
  const closeTerminal = vi.fn().mockResolvedValue(undefined);
  const createTerminal = vi.fn();
  const writeTerminal = vi.fn();
  const recordHistory = vi.fn();

  beforeEach(() => {
    nextId = 0;
    closeTerminal.mockClear();
    createTerminal.mockReset();
    writeTerminal.mockReset();
    recordHistory.mockReset();
    recordHistory.mockResolvedValue({ recorded: true });
    writeTerminal.mockResolvedValue(undefined);
    createTerminal.mockImplementation(() => {
      nextId += 1;
      return Promise.resolve({
        sessionId: `id-${nextId}`,
        label: `S${nextId}`,
        kind: 'local',
        pid: 100 + nextId,
        cwd: '/',
        machine: 'host',
        sessionDirectory: `sessions/host/2026-01-01_00.00_S${nextId}_local`,
        startedAt: '2026-01-01T00:00:00+00:00',
      });
    });
    vi.stubGlobal('smartTerminal', {
        createTerminal,
        closeTerminal,
        writeTerminal,
        recordHistory,
        onTerminalData: (listener: typeof emitData) => {
          emitData = listener;
          return () => undefined;
        },
        onTerminalExit: (listener: typeof emitExit) => {
          emitExit = listener;
          return () => undefined;
        },
        onTerminalEnvironment: (listener: typeof emitEnvironment) => {
          emitEnvironment = listener;
          return () => undefined;
        },
    });
  });

  it('creates sessions with sequential labels and activates the last one', async () => {
    const store = new SessionsStore();
    await store.createLocal();
    await store.createLocal();
    expect(store.sessions().map((s) => s.label)).toEqual(['S1', 'S2']);
    expect(store.activeId()).toBe('id-2');
  });

  it('stores the creation environment and applies late detection events', async () => {
    createTerminal.mockResolvedValueOnce({
      sessionId: 'id-1', label: 'S1', kind: 'local', pid: 101, cwd: '/', machine: 'host',
      sessionDirectory: 'sessions/host/2026-01-01_00.00_S1_local', startedAt: '2026-01-01T00:00:00+00:00',
      environment: { os: 'linux', shell: 'bash', source: 'local', detectedAt: '2026-01-01T00:00:00.000Z' },
    });
    const store = new SessionsStore();
    await store.createLocal();
    expect(store.sessions()[0]?.environment).toMatchObject({ os: 'linux', shell: 'bash', source: 'local' });
    emitEnvironment({ sessionId: 'id-1', environment: { os: 'macos', shell: 'zsh', source: 'ssh-probe', detectedAt: '2026-01-02T00:00:00.000Z' } });
    expect(store.sessions()[0]?.environment).toMatchObject({ os: 'macos', shell: 'zsh', source: 'ssh-probe' });
  });

  it('closes the PTY, removes the tab, and does not reuse labels', async () => {
    const store = new SessionsStore();
    await store.createLocal();
    await store.createLocal();
    store.close('id-2');
    expect(closeTerminal).toHaveBeenCalledWith({ sessionId: 'id-2' });
    expect(store.activeId()).toBe('id-1');
    await store.createLocal();
    expect(store.sessions().map((s) => s.label)).toEqual(['S1', 'S3']);
    store.close('id-1');
    store.close('id-3');
    expect(store.activeId()).toBeNull();
  });

  it('preserves drafts per session and marks terminated sessions without closing the PTY again', async () => {
    const store = new SessionsStore();
    await store.createLocal();
    await store.createLocal();
    store.setDraft('id-1', 'ls');
    store.select('id-1');
    expect(store.activeDraft()).toBe('ls');
    emitExit({ sessionId: 'id-2', exitCode: 0 });
    expect(store.sessions()[1]?.status).toBe('exited');
    store.close('id-2');
    expect(closeTerminal).not.toHaveBeenCalled();
  });

  it('buffers output until the panel attaches', async () => {
    const store = new SessionsStore();
    emitData({ sessionId: 'id-1', data: 'a' });
    const received: string[] = [];
    store.attachOutput('id-1', (data) => received.push(data));
    emitData({ sessionId: 'id-1', data: 'b' });
    expect(received).toEqual(['a', 'b']);
  });

  it('exposes a creation error without adding a tab', async () => {
    createTerminal.mockRejectedValueOnce(new Error('boom'));
    const store = new SessionsStore();
    expect(await store.createLocal()).toBeNull();
    expect(store.createError()).not.toBeNull();
    expect(store.sessions()).toEqual([]);
  });

  describe('sendActive', () => {
    it('sends to the active PTY, adding \\r, and clears the draft', async () => {
      const store = new SessionsStore();
      await store.createLocal();
      store.setDraft('id-1', 'ls');
      expect(await store.sendActive('ls')).toBe(true);
      expect(writeTerminal).toHaveBeenCalledWith({ sessionId: 'id-1', data: 'ls\r' });
      expect(store.activeDraft()).toBe('');
    });

    it('does not add \\r when the text already ends with \\r or \\n', async () => {
      const store = new SessionsStore();
      await store.createLocal();
      await store.sendActive('a\r');
      await store.sendActive('b\n');
      expect(writeTerminal.mock.calls.map((c) => c[0].data)).toEqual(['a\r', 'b\n']);
    });

    it('does not send when empty, without a session, exited, or too large', async () => {
      const store = new SessionsStore();
      expect(await store.sendActive('ls')).toBe(false);
      await store.createLocal();
      expect(await store.sendActive('')).toBe(false);
      expect(await store.sendActive('x'.repeat(64 * 1024))).toBe(false);
      emitExit({ sessionId: 'id-1', exitCode: 0 });
      expect(await store.sendActive('ls')).toBe(false);
      expect(writeTerminal).not.toHaveBeenCalled();
    });

    it('records assisted history only after a successful send', async () => {
      const store = new SessionsStore();
      await store.createLocal();
      expect(await store.sendActive('ls -la')).toBe(true);
      expect(recordHistory).toHaveBeenCalledWith({ sessionId: 'id-1', text: 'ls -la' });
      recordHistory.mockClear();
      writeTerminal.mockRejectedValueOnce(new Error('boom'));
      expect(await store.sendActive('pwd')).toBe(false);
      expect(recordHistory).not.toHaveBeenCalled();
    });

    it('a history error does not undo the send', async () => {
      recordHistory.mockRejectedValueOnce(new Error('history down'));
      const store = new SessionsStore();
      await store.createLocal();
      store.setDraft('id-1', 'ls');
      expect(await store.sendActive('ls')).toBe(true);
      expect(store.activeDraft()).toBe('');
    });

    it('preserves the draft when writing fails', async () => {
      writeTerminal.mockRejectedValueOnce(new Error('boom'));
      const store = new SessionsStore();
      await store.createLocal();
      store.setDraft('id-1', 'ls');
      expect(await store.sendActive('ls')).toBe(false);
      expect(store.activeDraft()).toBe('ls');
    });

    it('clears only the active session draft', async () => {
      const store = new SessionsStore();
      await store.createLocal();
      await store.createLocal();
      store.setDraft('id-1', 'one');
      store.setDraft('id-2', 'due');
      await store.sendActive('due');
      expect(store.activeDraft()).toBe('');
      store.select('id-1');
      expect(store.activeDraft()).toBe('one');
    });
  });

  it('labels for the four sync states', () => {
    expect(SYNC_LABELS).toEqual({
      synced: 'GitHub synced',
      syncing: 'GitHub syncing…',
      offline: 'GitHub offline',
      error: 'GitHub sync error',
    });
  });
});
