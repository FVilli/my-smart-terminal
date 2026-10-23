import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TerminalDataEvent, TerminalExitEvent } from '@smart-terminal/contracts';
import { SYNC_LABELS } from '../apps/renderer/src/app/session.model';
import { SessionsStore } from '../apps/renderer/src/app/sessions-store';

describe('SessionsStore', () => {
  let nextId = 0;
  let emitData: (event: TerminalDataEvent) => void;
  let emitExit: (event: TerminalExitEvent) => void;
  const closeTerminal = vi.fn().mockResolvedValue(undefined);
  const createTerminal = vi.fn();
  const writeTerminal = vi.fn();

  beforeEach(() => {
    nextId = 0;
    closeTerminal.mockClear();
    createTerminal.mockReset();
    writeTerminal.mockReset();
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
        onTerminalData: (listener: typeof emitData) => {
          emitData = listener;
          return () => undefined;
        },
        onTerminalExit: (listener: typeof emitExit) => {
          emitExit = listener;
          return () => undefined;
        },
    });
  });

  it('crea sessioni con etichette progressive e attiva l’ultima', async () => {
    const store = new SessionsStore();
    await store.createLocal();
    await store.createLocal();
    expect(store.sessions().map((s) => s.label)).toEqual(['S1', 'S2']);
    expect(store.activeId()).toBe('id-2');
  });

  it('chiude il PTY, rimuove il tab, non riusa le etichette', async () => {
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

  it('conserva le bozze per sessione e segna le sessioni terminate senza richiudere il PTY', async () => {
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

  it('bufferizza l’output finché il pannello non si aggancia', async () => {
    const store = new SessionsStore();
    emitData({ sessionId: 'id-1', data: 'a' });
    const received: string[] = [];
    store.attachOutput('id-1', (data) => received.push(data));
    emitData({ sessionId: 'id-1', data: 'b' });
    expect(received).toEqual(['a', 'b']);
  });

  it('espone l’errore di creazione senza aggiungere tab', async () => {
    createTerminal.mockRejectedValueOnce(new Error('boom'));
    const store = new SessionsStore();
    expect(await store.createLocal()).toBeNull();
    expect(store.createError()).not.toBeNull();
    expect(store.sessions()).toEqual([]);
  });

  describe('sendActive', () => {
    it('invia al PTY attivo aggiungendo \\r e svuota la bozza', async () => {
      const store = new SessionsStore();
      await store.createLocal();
      store.setDraft('id-1', 'ls');
      expect(await store.sendActive('ls')).toBe(true);
      expect(writeTerminal).toHaveBeenCalledWith({ sessionId: 'id-1', data: 'ls\r' });
      expect(store.activeDraft()).toBe('');
    });

    it('non aggiunge \\r se il testo termina già con \\r o \\n', async () => {
      const store = new SessionsStore();
      await store.createLocal();
      await store.sendActive('a\r');
      await store.sendActive('b\n');
      expect(writeTerminal.mock.calls.map((c) => c[0].data)).toEqual(['a\r', 'b\n']);
    });

    it('non invia se vuoto, senza sessione, exited o troppo grande', async () => {
      const store = new SessionsStore();
      expect(await store.sendActive('ls')).toBe(false);
      await store.createLocal();
      expect(await store.sendActive('')).toBe(false);
      expect(await store.sendActive('x'.repeat(64 * 1024))).toBe(false);
      emitExit({ sessionId: 'id-1', exitCode: 0 });
      expect(await store.sendActive('ls')).toBe(false);
      expect(writeTerminal).not.toHaveBeenCalled();
    });

    it('conserva la bozza se la scrittura fallisce', async () => {
      writeTerminal.mockRejectedValueOnce(new Error('boom'));
      const store = new SessionsStore();
      await store.createLocal();
      store.setDraft('id-1', 'ls');
      expect(await store.sendActive('ls')).toBe(false);
      expect(store.activeDraft()).toBe('ls');
    });

    it('svuota solo la bozza della sessione attiva', async () => {
      const store = new SessionsStore();
      await store.createLocal();
      await store.createLocal();
      store.setDraft('id-1', 'uno');
      store.setDraft('id-2', 'due');
      await store.sendActive('due');
      expect(store.activeDraft()).toBe('');
      store.select('id-1');
      expect(store.activeDraft()).toBe('uno');
    });
  });

  it('etichette dei quattro stati di sync', () => {
    expect(SYNC_LABELS).toEqual({
      synced: 'GitHub synced',
      syncing: 'GitHub syncing…',
      offline: 'GitHub offline',
      error: 'GitHub sync error',
    });
  });
});
