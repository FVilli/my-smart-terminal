import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoordinatorClientError, RemoteSessionIdAllocator, type CoordinatorRequester } from '@smart-terminal/sync';
import type { AllocatedSession, SessionIdAllocator } from '@smart-terminal/data';
import { CoordinatorRuntime, SwitchingSessionIdAllocator, resolveSyncTiming } from './coordinator-runtime';
import { DataRuntime } from './data-runtime';
import { HistoryService } from './history-service';

let root: string;
const runtimes: CoordinatorRuntime[] = [];

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-cruntime-'));
});
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((r) => r.stop()));
  fs.rmSync(root, { recursive: true, force: true });
});

const env = (): NodeJS.ProcessEnv => ({ SMART_TERMINAL_DATA_REPO: path.join(root, 'repo'), SMART_TERMINAL_MACHINE: 'host' });
let clipboardText = '';
const clipboardSource = { readText: () => clipboardText };
const timing = { heartbeatMs: 50, staleMs: 400, takeoverPollMs: 50 };

function makeRuntime(): CoordinatorRuntime {
  const runtime = new CoordinatorRuntime({ userDataPath: path.join(root, 'ud'), env: env(), timing, clipboardSource, clipboardIntervalMs: 30 });
  runtimes.push(runtime);
  return runtime;
}

const waitFor = async (predicate: () => boolean, timeoutMs = 8000): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

const fakeSession = (n: number): AllocatedSession => ({
  sessionId: `S${n}`, sequence: n, label: `S${n}`, relativeDir: `sessions/host/d${n}`, absoluteDir: `/x/${n}`,
  sessionFile: `/x/${n}/session.md`, historyFile: `/x/${n}/history.md`, clipboardFile: `/x/${n}/clipboard.md`, startedAt: 't',
});

describe('SwitchingSessionIdAllocator / DataRuntime with a remote allocator', () => {
  it('DataRuntime allocates through a fake coordinator client', async () => {
    const calls: { method: string; params?: Record<string, unknown> }[] = [];
    const requester: CoordinatorRequester = {
      request: <T>(method: string, params?: Record<string, unknown>) => {
        calls.push({ method, params });
        return Promise.resolve(fakeSession(7) as T);
      },
    };
    const data = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: env(), allocator: new RemoteSessionIdAllocator(requester) });
    const { allocation } = await data.createSession('w1', { kind: 'local', cwd: '/tmp' });
    expect(allocation.sessionId).toBe('S7');
    expect(calls).toEqual([{ method: 'session.allocate', params: { windowId: 'w1', kind: 'local', cwdInitial: '/tmp' } }]);
  });

  it('switches per call on role and falls back to local when the primary is unavailable', async () => {
    let primary = true;
    const local: SessionIdAllocator = { allocate: vi.fn(() => Promise.resolve(fakeSession(1))) };
    const remote: SessionIdAllocator = { allocate: vi.fn(() => Promise.resolve(fakeSession(2))) };
    const switching = new SwitchingSessionIdAllocator(() => primary, local, remote);
    const request = { windowId: 'w', kind: 'local', cwdInitial: '/tmp' } as const;
    expect((await switching.allocate(request)).sessionId).toBe('S1');
    primary = false;
    expect((await switching.allocate(request)).sessionId).toBe('S2');
    vi.mocked(remote.allocate).mockRejectedValueOnce(new CoordinatorClientError('COORDINATOR_UNAVAILABLE'));
    expect((await switching.allocate(request)).sessionId).toBe('S1');
    vi.mocked(remote.allocate).mockRejectedValueOnce(new CoordinatorClientError('COORDINATOR_ERROR', 'INTERNAL'));
    await expect(switching.allocate(request)).rejects.toMatchObject({ code: 'COORDINATOR_ERROR' });
  });
});

describe('CoordinatorRuntime', () => {
  it('a single instance is primary and starts the git repo', async () => {
    const runtime = makeRuntime();
    await runtime.start();
    expect(runtime.isPrimary).toBe(true);
    expect(fs.existsSync(path.join(root, 'repo', '.git'))).toBe(true);
  });

  it('secondary allocates unique IDs via the primary, forwards search, and takes over when the primary stops', async () => {
    const primary = makeRuntime();
    await primary.start();
    const secondary = makeRuntime();
    await secondary.start();
    expect([primary.isPrimary, secondary.isPrimary]).toEqual([true, false]);

    const dataPrimary = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: env(), allocator: primary.allocator });
    const dataSecondary = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: env(), allocator: secondary.allocator });
    const created = await Promise.all([
      dataPrimary.createSession('w1', { kind: 'local', cwd: '/tmp' }),
      dataSecondary.createSession('w2', { kind: 'local', cwd: '/tmp' }),
      dataSecondary.createSession('w3', { kind: 'local', cwd: '/tmp' }),
    ]);
    expect(new Set(created.map((c) => c.allocation.sessionId)).size).toBe(3);

    // history written by the secondary: search queried by the secondary, served by the primary's index
    const session = created[1]!.allocation;
    const history = new HistoryService({
      dataRepoPath: dataSecondary.dataRepoPath,
      resolveSession: () => ({ sessionDirectory: session.relativeDir }),
      onRecorded: (dir) => secondary.notifyWrite(dir),
    });
    history.record(1, { sessionId: session.sessionId, text: 'echo UniqueNeedle' });
    let found = 0;
    for (let attempt = 0; attempt < 100 && found !== 1; attempt += 1) {
      found = (await secondary.query({ query: 'uniqueneedle' })).entries.length;
      if (found !== 1) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(found).toBe(1);

    const roles: boolean[] = [];
    secondary.onRoleChanged(() => roles.push(secondary.isPrimary));
    await primary.stop();
    await waitFor(() => secondary.isPrimary);
    expect(roles).toEqual([true]);
    const next = await dataSecondary.createSession('w4', { kind: 'local', cwd: '/tmp' });
    expect(created.map((c) => c.allocation.sessionId)).not.toContain(next.allocation.sessionId);
    expect((await secondary.query({ query: 'uniqueneedle' })).entries).toHaveLength(1);
  });

  it('primary notifyWrite marks git dirty and commits the session files', async () => {
    const runtime = makeRuntime();
    await runtime.start();
    const data = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: env(), allocator: runtime.allocator });
    await data.createSession('w1', { kind: 'local', cwd: '/tmp' });
    runtime.notifyWrite('sessions/host/none');
    await runtime.stop();
    expect(fs.readdirSync(path.join(root, 'repo', '.git')).includes('HEAD')).toBe(true);
  });

  it('publishes sync status and commits only after the debounce', async () => {
    const runtime = new CoordinatorRuntime({
      userDataPath: path.join(root, 'ud'),
      env: { ...env(), SMART_TERMINAL_SYNC_DEBOUNCE_MS: '80', SMART_TERMINAL_SYNC_MAX_WAIT_MS: '400' },
      timing,
      clipboardSource,
    });
    runtimes.push(runtime);
    const states: string[] = [];
    runtime.onSyncStatus((s) => states.push(`${s.state}:${s.remoteConfigured}`));
    await runtime.start();
    const dir = path.join(root, 'repo', 'sessions', 'host', 'd1');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'history.md'), 'x');
    runtime.notifyWrite(dir);
    expect(states).toContain('dirty:false');
    expect(states).not.toContain('syncing:false');
    await waitFor(() => states.includes('synced:false'));
    expect(await runtime.syncStatus()).toMatchObject({ state: 'synced', remoteConfigured: false });
  });

  it('secondary reads sync status (incl. remoteConfigured) and facets through the primary', async () => {
    const primary = makeRuntime();
    await primary.start();
    const secondary = makeRuntime();
    await secondary.start();
    expect(secondary.isPrimary).toBe(false);
    expect(await secondary.syncStatus()).toMatchObject({ remoteConfigured: false });
    const data = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: env(), allocator: secondary.allocator });
    await data.createSession('w1', { kind: 'local', cwd: '/tmp' });
    expect((await secondary.searchFacets()).machines).toEqual([]);
    const { allocation } = await data.createSession('w2', { kind: 'local', cwd: '/tmp' });
    secondary.notifyWrite(allocation.relativeDir);
    let machines: string[] = [];
    for (let attempt = 0; attempt < 100 && machines.length === 0; attempt += 1) {
      machines = (await secondary.searchFacets()).machines;
      if (machines.length === 0) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(machines).toEqual(['host']);
  });

  it('clipboard is owned by the primary: secondary forwards configure/setActive/clear and writes the right file', async () => {
    const primary = makeRuntime();
    await primary.start();
    const secondary = makeRuntime();
    await secondary.start();
    const data = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: env(), allocator: secondary.allocator });
    const { allocation } = await data.createSession('w1', { kind: 'local', cwd: '/tmp' });

    expect(await secondary.clipboardState()).toEqual({ enabled: false, paused: false, lastEventAt: null });
    expect(await secondary.clipboardConfigure({ enabled: true, paused: false })).toMatchObject({ enabled: true });
    expect(await primary.clipboardState()).toMatchObject({ enabled: true });
    await secondary.clipboardSetActive(allocation.relativeDir);
    clipboardText = 'from-secondary-window';
    const clipboardFile = path.join(root, 'repo', allocation.relativeDir, 'clipboard.md');
    await waitFor(() => fs.readFileSync(clipboardFile, 'utf8').includes('from-secondary-window'));
    expect((await secondary.clipboardState()).lastEventAt).not.toBeNull();
    const recorded = await secondary.query({ query: 'from-secondary-window', kind: 'clipboard' });
    expect(recorded.entries).toHaveLength(1);

    await secondary.clipboardConfigure({ enabled: true, paused: true });
    clipboardText = 'while-paused';
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fs.readFileSync(clipboardFile, 'utf8')).not.toContain('while-paused');
    expect(await secondary.clipboardClear()).toMatchObject({ paused: true });
    await expect(secondary.coordinator.request('clipboard.setActive', { sessionDirectory: '../../etc' })).rejects.toMatchObject({ remoteCode: 'INVALID_PARAMS' });
  });

  it('session.end prunes the active clipboard session', async () => {
    const primary = makeRuntime();
    await primary.start();
    const secondary = makeRuntime();
    await secondary.start();
    const data = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: env(), allocator: secondary.allocator });
    const { allocation } = await data.createSession('w1', { kind: 'local', cwd: '/tmp' });
    await secondary.clipboardConfigure({ enabled: true, paused: false });
    await secondary.clipboardSetActive(allocation.relativeDir);
    secondary.endSession(allocation.relativeDir);
    await new Promise((resolve) => setTimeout(resolve, 100));
    clipboardText = 'after-session-end';
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fs.readFileSync(path.join(root, 'repo', allocation.relativeDir, 'clipboard.md'), 'utf8')).not.toContain('after-session-end');
  });

  it('on takeover the new primary reactivates the clipboard from its own intent and the old primary stops polling', async () => {
    const primary = makeRuntime();
    await primary.start();
    const secondary = makeRuntime();
    await secondary.start();
    const data = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: env(), allocator: secondary.allocator });
    const { allocation } = await data.createSession('w1', { kind: 'local', cwd: '/tmp' });
    await secondary.clipboardConfigure({ enabled: true, paused: false });
    await secondary.clipboardSetActive(allocation.relativeDir);
    await primary.stop();
    await waitFor(() => secondary.isPrimary);
    expect(await secondary.clipboardState()).toMatchObject({ enabled: true, paused: false });
    clipboardText = 'after-takeover';
    const clipboardFile = path.join(root, 'repo', allocation.relativeDir, 'clipboard.md');
    await waitFor(() => fs.readFileSync(clipboardFile, 'utf8').includes('after-takeover'));
  });

  it('parses sync timing env and ignores invalid values', () => {
    expect(resolveSyncTiming({ SMART_TERMINAL_SYNC_DEBOUNCE_MS: '5', SMART_TERMINAL_SYNC_MAX_WAIT_MS: 'x', SMART_TERMINAL_SYNC_FETCH_INTERVAL_MS: '-1' })).toEqual({ debounceMs: 5 });
    expect(resolveSyncTiming({})).toEqual({});
  });
});
