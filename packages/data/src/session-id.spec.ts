import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFrontmatter } from './frontmatter';
import { parseClipboardDocument, parseHistoryDocument, parseSessionDocument } from './schema';
import { FileSessionIdAllocator, SessionIdError, type FileSessionIdAllocatorOptions } from './session-id';

let root: string;
let repo: string;
let lockDir: string;
const request = { windowId: 'w1', kind: 'local', cwdInitial: '/home/u' } as const;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-sid-'));
  repo = path.join(root, 'data');
  lockDir = path.join(root, 'locks');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const make = (extra: Partial<FileSessionIdAllocatorOptions> = {}): FileSessionIdAllocator =>
  new FileSessionIdAllocator({ dataRepoPath: repo, machine: 'host', lockDir, retryMs: 5, ...extra });

const counterPath = (): string => path.join(repo, 'sessions', 'host', 'counter.md');
const lockPaths = (): string[] => (fs.existsSync(lockDir) ? fs.readdirSync(lockDir) : []);

describe('FileSessionIdAllocator', () => {
  it('allocates sequential ids, creates directory and the three files', async () => {
    const clock = (): Date => new Date(2026, 9, 22, 9, 5, 3);
    const allocator = make({ clock });
    const first = await allocator.allocate(request);
    const second = await allocator.allocate({ ...request, kind: 'ssh', sshAlias: 'Prod Box' });
    expect(first).toMatchObject({
      sessionId: 'S1',
      sequence: 1,
      label: 'S1',
      relativeDir: 'sessions/host/2026-10-22_09.05_S1_local',
    });
    expect(first.absoluteDir).toBe(path.join(repo, 'sessions', 'host', '2026-10-22_09.05_S1_local'));
    expect(second.relativeDir).toBe('sessions/host/2026-10-22_09.05_S2_prod-box');
    expect(first.startedAt).toMatch(/^2026-10-22T09:05:03[+-]\d{2}:\d{2}$/);
    expect(parseSessionDocument(fs.readFileSync(first.sessionFile, 'utf8')).meta).toMatchObject({ session_id: 'S1', machine: 'host', window_id: 'w1', kind: 'local', cwd_initial: '/home/u', started_at: first.startedAt });
    expect(parseSessionDocument(fs.readFileSync(second.sessionFile, 'utf8')).meta).toMatchObject({ kind: 'ssh', ssh_alias: 'Prod Box' });
    expect(parseHistoryDocument(fs.readFileSync(first.historyFile, 'utf8')).events).toEqual([]);
    expect(parseClipboardDocument(fs.readFileSync(first.clipboardFile, 'utf8')).events).toEqual([]);
    const counter = parseFrontmatter(fs.readFileSync(counterPath(), 'utf8')).data;
    expect(counter).toMatchObject({ schema_version: 1, machine: 'host', last_session: 2 });
    expect(typeof counter['updated_at']).toBe('string');
    expect(fs.readdirSync(first.absoluteDir).sort()).toEqual(['clipboard.md', 'history.md', 'session.md']);
    expect(lockPaths()).toEqual([]);
  });

  it('allocates distinct ids for concurrent calls in one process', async () => {
    const a = make();
    const b = make();
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? a : b).allocate(request)));
    const labels = results.map((r) => r.label).sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)));
    expect(labels).toEqual(Array.from({ length: 10 }, (_, i) => `S${i + 1}`));
    expect(lockPaths()).toEqual([]);
  });

  it('allocates distinct ids across separate processes', async () => {
    const worker = fileURLToPath(new URL('./session-id.worker.ts', import.meta.url));
    const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
    const run = (): Promise<string[]> =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', worker, repo, 'host', lockDir, '6'], { cwd: repoRoot });
        let out = '';
        let err = '';
        child.stdout.on('data', (d: Buffer) => (out += d.toString()));
        child.stderr.on('data', (d: Buffer) => (err += d.toString()));
        child.on('close', (code) => (code === 0 ? resolve(JSON.parse(out) as string[]) : reject(new Error(err))));
      });
    const all = (await Promise.all([run(), run(), run()])).flat();
    expect(new Set(all).size).toBe(18);
    expect([...all].sort((x, y) => Number(x.slice(1)) - Number(y.slice(1)))).toEqual(Array.from({ length: 18 }, (_, i) => `S${i + 1}`));
    expect(parseFrontmatter(fs.readFileSync(counterPath(), 'utf8')).data['last_session']).toBe(18);
    expect(lockPaths()).toEqual([]);
  }, 60_000);

  it('continues after restart and never reuses ids after a gap', async () => {
    await make().allocate(request);
    await make().allocate(request);
    // simula crash dopo prenotazione: counter avanzato ma directory mai creata
    fs.writeFileSync(counterPath(), fs.readFileSync(counterPath(), 'utf8').replace('last_session: 2', 'last_session: 5'));
    expect((await make().allocate(request)).label).toBe('S6');
  });

  it('rebuilds a missing or corrupt counter from existing directories', async () => {
    await make().allocate(request);
    await make().allocate(request);
    await make().allocate(request);
    for (const broken of [null, 'garbage', '---\nschema_version: 1\nmachine: host\nlast_session: "x"\n---\n', '---\nschema_version: 2\nmachine: host\nlast_session: 0\n---\n', '---\nschema_version: 1\nmachine: other\nlast_session: 0\n---\n']) {
      if (broken === null) {
        fs.rmSync(counterPath());
      } else {
        fs.writeFileSync(counterPath(), broken);
      }
      const allocated = await make().allocate(request);
      const expected = fs.readdirSync(path.join(repo, 'sessions', 'host')).filter((n) => n !== 'counter.md').length;
      expect(allocated.sequence).toBe(expected);
    }
  });

  it('skips an existing directory and retries with the next id', async () => {
    const clock = (): Date => new Date(2026, 0, 1, 0, 0, 0);
    const collision = path.join(repo, 'sessions', 'host', '2026-01-01_00.00_S1_local');
    fs.mkdirSync(collision, { recursive: true });
    fs.writeFileSync(counterPath(), '---\nschema_version: 1\nmachine: host\nlast_session: 0\nupdated_at: "2026-01-01T00:00:00+00:00"\n---\n');
    const allocated = await make({ clock }).allocate(request);
    expect(allocated.label).toBe('S2');
    expect(fs.readdirSync(collision)).toEqual([]);
  });

  it('recovers a stale lock whose owner is dead', async () => {
    const allocator = make({ isPidAlive: () => false });
    const lockName = await seedLock({ pid: 999_999, nonce: 'old', heartbeat_at: '2020-01-01T00:00:00+00:00' });
    expect((await allocator.allocate(request)).label).toBe('S1');
    expect(lockPaths()).not.toContain(lockName);
    expect(lockPaths()).toEqual([]);
  });

  it('recovers a stale lock with unreadable owner', async () => {
    const lockName = await seedLock(null);
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(path.join(lockDir, lockName), old, old);
    expect((await make().allocate(request)).label).toBe('S1');
  });

  it('respects a lock held by a live process, even when old, and times out', async () => {
    const lockName = await seedLock({ pid: 4242, nonce: 'live', heartbeat_at: '2020-01-01T00:00:00+00:00' });
    await expect(make({ isPidAlive: (pid) => pid === 4242, timeoutMs: 80 }).allocate(request)).rejects.toEqual(expect.objectContaining({ code: 'SESSION_ID_LOCK_TIMEOUT' }));
    expect(lockPaths()).toEqual([lockName]);
    expect(fs.existsSync(counterPath())).toBe(false);
  });

  it('respects a fresh lock of a dead process until stale, and a fresh unreadable lock', async () => {
    const fresh = new Date().toISOString().replace('Z', '+00:00');
    await seedLock({ pid: 999_999, nonce: 'recent', heartbeat_at: fresh });
    await expect(make({ isPidAlive: () => false, timeoutMs: 60 }).allocate(request)).rejects.toBeInstanceOf(SessionIdError);
  });

  it('releases the lock when allocation fails', async () => {
    fs.mkdirSync(path.join(repo, 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'sessions', 'host'), 'not a directory');
    await expect(make().allocate(request)).rejects.toThrow();
    expect(lockPaths()).toEqual([]);
  });

  it('rejects invalid machine and invalid requests', async () => {
    expect(() => make({ machine: '../x' })).toThrow();
    await expect(make().allocate({ ...request, kind: 'ssh' })).rejects.toEqual(expect.objectContaining({ code: 'SESSION_ID_INVALID_REQUEST' }));
    await expect(make().allocate({ ...request, cwdInitial: '' })).rejects.toBeInstanceOf(SessionIdError);
  });

  async function seedLock(owner: { pid: number; nonce: string; heartbeat_at: string } | null): Promise<string> {
    // Il nome è derivato da repo+machine: lo ricava un allocator reale creando e lasciando il lock.
    const probe = make({ timeoutMs: 1 });
    const name = (probe as unknown as { lockPath: string }).lockPath;
    fs.mkdirSync(name, { recursive: true });
    if (owner !== null) {
      fs.writeFileSync(path.join(name, 'owner.json'), JSON.stringify({ ...owner, created_at: owner.heartbeat_at }));
    }
    return path.basename(name);
  }
});
