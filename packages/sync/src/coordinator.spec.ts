import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileSessionIdAllocator, type AllocatedSession } from '@smart-terminal/data';
import { CoordinatorClient, type CoordinatorClientError, RemoteSessionIdAllocator } from './client';
import { Coordinator, type PrimaryHandle } from './coordinator';
import { PRIMARY_LOCK_NAME, PrimaryElection } from './election';
import { MAX_LINE_BYTES, type CoordinatorServices } from './protocol';
import { CoordinatorServer, coordinatorEndpoint, tokenPath } from './server';

let root: string;
const children: ChildProcess[] = [];
const coordinators: Coordinator[] = [];

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-coord-'));
});

afterEach(async () => {
  await Promise.all(coordinators.splice(0).map((c) => c.stop()));
  for (const child of children.splice(0)) child.kill('SIGKILL');
  fs.rmSync(root, { recursive: true, force: true });
});

const waitFor = async (predicate: () => boolean, timeoutMs = 8000): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

function makeServices(userData: string, overrides: Partial<CoordinatorServices> = {}): CoordinatorServices {
  const allocator = new FileSessionIdAllocator({
    dataRepoPath: path.join(userData, 'repo'),
    machine: 'host',
    lockDir: path.join(userData, 'coordinator', 'locks'),
    retryMs: 5,
  });
  return {
    allocate: (request) => allocator.allocate(request),
    searchQuery: () => [],
    searchUpsert: () => undefined,
    searchRefresh: () => undefined,
    syncStatus: () => ({ state: 'synced', remoteConfigured: false }),
    searchFacets: () => [],
    clipboardState: () => ({ enabled: false, paused: false, lastEventAt: null }),
    clipboardConfigure: () => ({ enabled: false, paused: false, lastEventAt: null }),
    clipboardSetActive: () => ({ enabled: false, paused: false, lastEventAt: null }),
    clipboardClear: () => ({ enabled: false, paused: false, lastEventAt: null }),
    sessionEnd: () => undefined,
    syncDirty: () => undefined,
    ...overrides,
  };
}

const fastOptions = { heartbeatMs: 50, staleMs: 400, takeoverPollMs: 50 };

function makeCoordinator(userData: string, overrides: Partial<CoordinatorServices> = {}, extra: { stops?: string[] } = {}): Coordinator {
  const coordinator = new Coordinator({
    userDataPath: userData,
    ...fastOptions,
    createPrimary: (): PrimaryHandle => ({ services: makeServices(userData, overrides), stop: () => void extra.stops?.push('stopped') }),
  });
  coordinators.push(coordinator);
  return coordinator;
}

describe('PrimaryElection', () => {
  const dir = (): string => path.join(root, 'coordinator');

  it('acquires atomically and writes owner.json', () => {
    const election = new PrimaryElection({ coordinatorDir: dir(), heartbeatMs: 50 });
    expect(election.tryAcquire()).toBe('acquired');
    const owner = election.readOwner();
    expect(owner).toMatchObject({ pid: process.pid, role: 'primary' });
    expect(election.nonce).toBe(owner?.nonce);
    expect(new PrimaryElection({ coordinatorDir: dir() }).tryAcquire()).toBe('held');
    election.release();
  });

  it('only one of many concurrent elections wins', () => {
    const elections = Array.from({ length: 8 }, () => new PrimaryElection({ coordinatorDir: dir(), heartbeatMs: 50 }));
    const winners = elections.filter((e) => e.tryAcquire() === 'acquired');
    expect(winners).toHaveLength(1);
    winners[0]?.release();
  });

  it('heartbeats and releases only with its own nonce', async () => {
    const election = new PrimaryElection({ coordinatorDir: dir(), heartbeatMs: 30 });
    election.tryAcquire();
    const first = election.readOwner()?.heartbeat_at;
    await waitFor(() => election.readOwner()?.heartbeat_at !== first);
    const lock = path.join(dir(), PRIMARY_LOCK_NAME);
    const foreign = { pid: 1, nonce: 'foreign', role: 'primary', started_at: 'x', heartbeat_at: new Date().toISOString() };
    let lost = 0;
    const other = new PrimaryElection({ coordinatorDir: path.join(root, 'other'), onLost: () => (lost += 1), heartbeatMs: 30 });
    other.tryAcquire();
    fs.writeFileSync(path.join(root, 'other', PRIMARY_LOCK_NAME, 'owner.json'), JSON.stringify(foreign));
    await waitFor(() => lost === 1);
    expect(other.held).toBe(false);
    other.release();
    expect(fs.existsSync(path.join(root, 'other', PRIMARY_LOCK_NAME))).toBe(true);
    election.release();
    expect(fs.existsSync(lock)).toBe(false);
  });

  it('recovers a stale lock with a dead pid but not a live or fresh one', () => {
    const lock = path.join(dir(), PRIMARY_LOCK_NAME);
    const writeOwner = (pid: number, heartbeatAgeMs: number): void => {
      fs.rmSync(lock, { recursive: true, force: true });
      fs.mkdirSync(lock, { recursive: true });
      const at = new Date(Date.now() - heartbeatAgeMs).toISOString();
      fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid, nonce: 'old', role: 'primary', started_at: at, heartbeat_at: at }));
    };
    const isPidAlive = (pid: number): boolean => pid === 111;
    const make = (): PrimaryElection => new PrimaryElection({ coordinatorDir: dir(), staleMs: 1000, isPidAlive, heartbeatMs: 1000 });
    writeOwner(222, 100); // fresh heartbeat
    expect(make().tryAcquire()).toBe('held');
    writeOwner(111, 5000); // stale but PID alive
    expect(make().tryAcquire()).toBe('held');
    writeOwner(222, 5000); // stale and PID dead
    const recovering = make();
    expect(recovering.tryAcquire()).toBe('acquired');
    expect(recovering.readOwner()?.nonce).not.toBe('old');
    recovering.release();
    // unreadable owner: only if the directory is old
    fs.mkdirSync(lock, { recursive: true });
    fs.writeFileSync(path.join(lock, 'owner.json'), '{broken');
    expect(make().tryAcquire()).toBe('held');
    const old = new Date(Date.now() - 5000);
    fs.utimesSync(lock, old, old);
    const again = make();
    expect(again.tryAcquire()).toBe('acquired');
    again.release();
  });
});

describe('Coordinator (in-process)', () => {
  it('two concurrent coordinators elect exactly one primary and the other becomes secondary', async () => {
    const a = makeCoordinator(root);
    const b = makeCoordinator(root);
    await Promise.all([a.start(), b.start()]);
    expect([a.role, b.role].sort()).toEqual(['primary', 'secondary']);
    const primary = a.isPrimary ? a : b;
    const secondary = a.isPrimary ? b : a;
    expect(await secondary.request('ping')).toMatchObject({ pid: process.pid, role: 'primary' });
    expect(primary.isPrimary).toBe(true);
  });

  it('secondary takes over when the primary stops, and notifies role changes', async () => {
    const stops: string[] = [];
    const a = makeCoordinator(root, {}, { stops });
    const b = makeCoordinator(root);
    const roles: string[] = [];
    b.onRoleChange((role) => roles.push(role));
    await a.start();
    await b.start();
    expect(b.role).toBe('secondary');
    await a.stop();
    await waitFor(() => b.isPrimary);
    expect(roles).toEqual(['secondary', 'primary']);
    expect(stops).toEqual(['stopped']);
    expect(await a.request('ping').catch((error: unknown) => (error as CoordinatorClientError).code)).toMatchObject({ role: 'primary' });
  });

  it('cleans socket and token on stop', async () => {
    const a = makeCoordinator(root);
    await a.start();
    const socket = coordinatorEndpoint(root);
    expect(fs.existsSync(socket)).toBe(true);
    await a.stop();
    expect(fs.existsSync(socket)).toBe(false);
    expect(fs.existsSync(tokenPath(root))).toBe(false);
    expect(fs.existsSync(path.join(root, 'coordinator', PRIMARY_LOCK_NAME))).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('uses restrictive permissions for dir, socket and token', async () => {
    const a = makeCoordinator(root);
    await a.start();
    const mode = (p: string): number => fs.statSync(p).mode & 0o777;
    expect(mode(path.join(root, 'coordinator'))).toBe(0o700);
    expect(mode(coordinatorEndpoint(root))).toBe(0o600);
    expect(mode(tokenPath(root))).toBe(0o600);
  });

  it('demotes to secondary when the lock is lost', async () => {
    const a = makeCoordinator(root);
    await a.start();
    fs.writeFileSync(
      path.join(root, 'coordinator', PRIMARY_LOCK_NAME, 'owner.json'),
      JSON.stringify({ pid: 1, nonce: 'thief', role: 'primary', started_at: 'x', heartbeat_at: new Date().toISOString() }),
    );
    await waitFor(() => a.role === 'secondary');
    expect(fs.existsSync(path.join(root, 'coordinator', PRIMARY_LOCK_NAME))).toBe(true);
  });
});

describe('RPC server', () => {
  async function startServer(overrides: Partial<CoordinatorServices> = {}): Promise<CoordinatorServer> {
    const server = new CoordinatorServer({ userDataPath: root, services: makeServices(root, overrides) });
    await server.start();
    return server;
  }

  const rawExchange = (payload: string | Buffer): Promise<string> =>
    new Promise((resolve) => {
      const socket = net.createConnection(coordinatorEndpoint(root));
      let data = '';
      socket.on('data', (chunk) => {
        data += chunk.toString('utf8');
        if (data.includes('\n')) socket.destroy();
      });
      socket.on('close', () => resolve(data));
      socket.on('error', () => resolve(data));
      socket.on('connect', () => socket.write(payload));
    });
  const token = (): string => fs.readFileSync(tokenPath(root), 'utf8');
  const line = (fields: Record<string, unknown>): string => `${JSON.stringify({ v: 1, id: 'r1', method: 'ping', params: {}, token: token(), ...fields })}\n`;

  it('answers ping and rejects wrong tokens, unknown methods, bad params and bad JSON', async () => {
    const server = await startServer();
    expect(JSON.parse(await rawExchange(line({})))).toMatchObject({ id: 'r1', ok: true, result: { role: 'primary', pid: process.pid } });
    expect(JSON.parse(await rawExchange(line({ token: 'wrong' })))).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
    expect(JSON.parse(await rawExchange(line({ method: 'fs.readFile' })))).toMatchObject({ ok: false, error: { code: 'UNKNOWN_METHOD' } });
    expect(JSON.parse(await rawExchange(line({ method: 'search.upsert', params: { sessionDirectory: 1 } })))).toMatchObject({ error: { code: 'INVALID_PARAMS' } });
    expect(JSON.parse(await rawExchange(line({ method: 'search.refresh', params: { extra: 1 } })))).toMatchObject({ error: { code: 'INVALID_PARAMS' } });
    expect(JSON.parse(await rawExchange(line({ v: 2 })))).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
    expect(JSON.parse(await rawExchange('not json\n'))).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
    await server.stop();
  });

  it('rejects oversize lines (with and without newline)', async () => {
    const server = await startServer();
    const big = 'x'.repeat(MAX_LINE_BYTES + 10);
    expect(JSON.parse(await rawExchange(`${big}\n`))).toMatchObject({ error: { code: 'LINE_TOO_LONG' } });
    expect(JSON.parse(await rawExchange(big))).toMatchObject({ error: { code: 'LINE_TOO_LONG' } });
    await server.stop();
  });

  it('sanitizes internal errors', async () => {
    const server = await startServer({
      searchRefresh: () => {
        throw new Error('/secret/path stack');
      },
    });
    const reply = await rawExchange(line({ method: 'search.refresh' }));
    expect(reply).not.toContain('secret');
    expect(JSON.parse(reply)).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
    await server.stop();
  });

  it('serves search/sync methods and handles pipelined requests in order', async () => {
    const upserts: string[] = [];
    const server = await startServer({ searchUpsert: (d) => void upserts.push(d), searchQuery: () => [{ machine: 'm', sessionId: 'S1', sessionDirectory: 'sessions/m/x', kind: 'history', timestamp: 't', text: 'hi' }] });
    const client = new CoordinatorClient({ userDataPath: root });
    expect(await client.request('search.upsert', { sessionDirectory: 'sessions/m/x' })).toEqual({ ok: true });
    expect(upserts).toEqual(['sessions/m/x']);
    expect(await client.request('search.query', { query: 'hi' })).toMatchObject({ entries: [{ text: 'hi' }] });
    expect(await client.request('sync.status')).toEqual({ state: 'synced', remoteConfigured: false });
    expect(await client.request('sync.dirty')).toEqual({ ok: true });
    expect(await client.request('search.refresh')).toEqual({ ok: true });
    const both = await rawExchange(line({ id: 'a' }) + line({ id: 'b' }));
    expect(both).toContain('"id":"a"');
    await server.stop();
  });

  it('serves facets/clipboard/session.end and validates their params strictly', async () => {
    const calls: string[] = [];
    const server = await startServer({
      searchFacets: () => ['a', 'b'],
      clipboardSetActive: (dir) => {
        calls.push(`active:${dir}`);
        return { enabled: true, paused: false, lastEventAt: null };
      },
      clipboardConfigure: (config) => {
        calls.push(`configure:${config.enabled}:${config.paused}`);
        return { ...config, lastEventAt: null };
      },
      sessionEnd: (dir) => void calls.push(`end:${dir}`),
    });
    const client = new CoordinatorClient({ userDataPath: root });
    const dir = 'sessions/host/2026-01-01_00.00_S1_local';
    expect(await client.request('search.facets')).toEqual({ machines: ['a', 'b'] });
    expect(await client.request('clipboard.state')).toEqual({ enabled: false, paused: false, lastEventAt: null });
    expect(await client.request('clipboard.configure', { enabled: true, paused: true })).toMatchObject({ enabled: true, paused: true });
    expect(await client.request('clipboard.setActive', { sessionDirectory: dir })).toMatchObject({ enabled: true });
    expect(await client.request('clipboard.setActive', { sessionDirectory: null })).toMatchObject({ enabled: true });
    expect(await client.request('clipboard.clear')).toMatchObject({ enabled: false });
    expect(await client.request('session.end', { sessionDirectory: dir })).toEqual({ ok: true });
    expect(calls).toEqual(['configure:true:true', `active:${dir}`, 'active:null', `end:${dir}`]);

    const invalid = async (method: string, params: Record<string, unknown>) =>
      expect(JSON.parse(await rawExchange(line({ method, params })))).toMatchObject({ ok: false, error: { code: 'INVALID_PARAMS' } });
    await invalid('search.facets', { x: 1 });
    await invalid('clipboard.state', { x: 1 });
    await invalid('clipboard.configure', { enabled: true });
    await invalid('clipboard.configure', { enabled: 'true', paused: false });
    await invalid('clipboard.configure', { enabled: true, paused: false, extra: 1 });
    await invalid('clipboard.setActive', {});
    await invalid('clipboard.setActive', { sessionDirectory: '../etc' });
    await invalid('clipboard.setActive', { sessionDirectory: 'sessions/../x/2026-01-01_00.00_S1_local' });
    await invalid('clipboard.setActive', { sessionDirectory: '/abs/path' });
    await invalid('clipboard.setActive', { sessionDirectory: 'sessions/host/zzz' });
    await invalid('clipboard.setActive', { sessionDirectory: 5 });
    await invalid('clipboard.clear', { x: 1 });
    await invalid('session.end', { sessionDirectory: null });
    await invalid('session.end', { sessionDirectory: 'sessions/host' });
    expect(calls).toHaveLength(4);
    await server.stop();
  });

  it('client maps failures to COORDINATOR_UNAVAILABLE / COORDINATOR_ERROR', async () => {
    const client = new CoordinatorClient({ userDataPath: root });
    await expect(client.request('ping')).rejects.toMatchObject({ code: 'COORDINATOR_UNAVAILABLE' });
    const server = await startServer();
    await expect(client.request('nope')).rejects.toMatchObject({ code: 'COORDINATOR_ERROR', remoteCode: 'UNKNOWN_METHOD' });
    await server.stop();
    await expect(client.request('ping')).rejects.toMatchObject({ code: 'COORDINATOR_UNAVAILABLE' });
  });

  it('allocates unique IDs through RPC from many concurrent clients', async () => {
    const server = await startServer();
    const allocator = new RemoteSessionIdAllocator(new CoordinatorClient({ userDataPath: root }));
    const results: AllocatedSession[] = await Promise.all(
      Array.from({ length: 12 }, (_, i) => allocator.allocate({ windowId: `w${i}`, kind: 'local', cwdInitial: '/tmp' })),
    );
    expect(new Set(results.map((r) => r.sessionId)).size).toBe(12);
    expect(results.every((r) => fs.existsSync(r.sessionFile))).toBe(true);
    await expect(allocator.allocate({ windowId: 'w', kind: 'ssh', cwdInitial: '/tmp' })).rejects.toMatchObject({ remoteCode: 'SESSION_ID_INVALID_REQUEST' });
    await server.stop();
  });
});

describe('Coordinator (multi-process)', () => {
  const tsxLoader = fileURLToPath(new URL('../../../node_modules/tsx/dist/loader.mjs', import.meta.url));
  const childScript = fileURLToPath(new URL('./testing/coordinator-child.ts', import.meta.url));

  interface ChildHandle {
    process: ChildProcess;
    events: { pid: number; role?: string; ready?: boolean }[];
  }

  function spawnChild(): ChildHandle {
    const child = spawn(process.execPath, ['--import', tsxLoader, childScript], {
      env: { ...process.env, CHILD_USER_DATA: root },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    children.push(child);
    const handle: ChildHandle = { process: child, events: [] };
    let buffer = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let index = buffer.indexOf('\n');
      while (index !== -1) {
        handle.events.push(JSON.parse(buffer.slice(0, index)) as ChildHandle['events'][number]);
        buffer = buffer.slice(index + 1);
        index = buffer.indexOf('\n');
      }
    });
    return handle;
  }

  const roleOf = (handle: ChildHandle): string | undefined => handle.events.filter((e) => e.role !== undefined).at(-1)?.role;

  it('elects one primary among two processes and the secondary takes over after kill -9', async () => {
    const first = spawnChild();
    await waitFor(() => roleOf(first) !== undefined, 20_000);
    const second = spawnChild();
    await waitFor(() => roleOf(second) !== undefined, 20_000);
    expect(roleOf(first)).toBe('primary');
    expect(roleOf(second)).toBe('secondary');

    const client = new CoordinatorClient({ userDataPath: root });
    const allocator = new RemoteSessionIdAllocator(client);
    const [one, two] = await Promise.all([
      allocator.allocate({ windowId: 'w1', kind: 'local', cwdInitial: '/tmp' }),
      allocator.allocate({ windowId: 'w2', kind: 'local', cwdInitial: '/tmp' }),
    ]);
    expect(one.sessionId).not.toBe(two.sessionId);

    first.process.kill('SIGKILL');
    await waitFor(() => roleOf(second) === 'primary', 15_000);
    expect(await client.request('ping')).toMatchObject({ pid: second.process.pid, role: 'primary' });
  }, 60_000);
});

describe('coordinator endpoint', () => {
  it('falls back to a short per-user temp path when userData is too deep', () => {
    const longUserData = path.join(root, 'x'.repeat(120), 'user-data');
    const endpoint = coordinatorEndpoint(longUserData);
    expect(Buffer.byteLength(endpoint)).toBeLessThan(100);
    expect(endpoint.startsWith(os.tmpdir())).toBe(true);
    expect(coordinatorEndpoint(path.join(root, 'short'))).toBe(path.join(root, 'short', 'coordinator', 'coordinator.sock'));
  });
});
