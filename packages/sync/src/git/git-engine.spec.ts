import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitEngine } from './git-engine';
import { GitSyncManager } from './git-sync-manager';

let root: string;
let remote: string;
let commands: string[][];

const git = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function machineRepo(name: string, overrides: { remote?: string | undefined; backoffMs?: number } = {}): { repo: string; engine: GitEngine } {
  const repo = path.join(root, name);
  const engine = new GitEngine({
    repoPath: repo,
    machine: name,
    remote: 'remote' in overrides ? overrides.remote : remote,
    backoffMs: overrides.backoffMs ?? 1,
    onCommand: (args) => commands.push([...args]),
  });
  return { repo, engine };
}

function writeSession(repo: string, machine: string, dir: string, content = 'x'): string {
  const target = path.join(repo, 'sessions', machine, dir);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'history.md'), content);
  return path.join(target, 'history.md');
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-git-'));
  remote = path.join(root, 'remote.git');
  commands = [];
  execFileSync('git', ['init', '--bare', '-b', 'main', remote]);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('GitEngine', () => {
  it('initialises a repo with sessions/, local identity and .gitignore', async () => {
    const { repo, engine } = machineRepo('a');
    await engine.initIfNeeded();
    expect(fs.existsSync(path.join(repo, 'sessions'))).toBe(true);
    expect(git(repo, 'symbolic-ref', '--short', 'HEAD')).toBe('main');
    expect(git(repo, 'config', '--local', 'user.name')).toContain('a');
    expect(git(repo, 'remote', 'get-url', 'origin')).toBe(remote);
    expect(fs.readFileSync(path.join(repo, '.gitignore'), 'utf8')).toContain('*.tmp');
  });

  it('syncs machine A and B through a bare remote and both see all files', async () => {
    const a = machineRepo('a');
    const b = machineRepo('b');
    writeSession(a.repo, 'a', 's1', 'from-a');
    expect(await a.engine.syncOnce()).toMatchObject({ state: 'synced' });
    writeSession(b.repo, 'b', 's1', 'from-b');
    expect(await b.engine.syncOnce()).toMatchObject({ state: 'synced' });
    expect(await a.engine.syncOnce()).toMatchObject({ state: 'synced' });
    for (const repo of [a.repo, b.repo]) {
      expect(fs.readFileSync(path.join(repo, 'sessions/a/s1/history.md'), 'utf8')).toBe('from-a');
      expect(fs.readFileSync(path.join(repo, 'sessions/b/s1/history.md'), 'utf8')).toBe('from-b');
    }
    expect(git(remote, 'rev-list', '--count', 'main')).toBe('2');
    expect(git(a.repo, 'log', '-1', '--format=%s')).toMatch(/^sessions: (a|b) \d{4}-\d{2}-\d{2}T/);
  });

  it('adopts an existing remote branch on first init without overwriting local files', async () => {
    const a = machineRepo('a');
    writeSession(a.repo, 'a', 's1');
    await a.engine.syncOnce();
    const b = machineRepo('b');
    writeSession(b.repo, 'b', 's1');
    await b.engine.initIfNeeded();
    expect(fs.existsSync(path.join(b.repo, 'sessions/a/s1/history.md'))).toBe(true);
    expect(fs.existsSync(path.join(b.repo, 'sessions/b/s1/history.md'))).toBe(true);
    expect(await b.engine.syncOnce()).toMatchObject({ state: 'synced' });
    expect(git(remote, 'ls-tree', '-r', '--name-only', 'main').split('\n').sort()).toEqual(['sessions/a/s1/history.md', 'sessions/b/s1/history.md']);
  });

  it('rebases concurrent commits from two machines', async () => {
    const a = machineRepo('a');
    const b = machineRepo('b');
    await a.engine.initIfNeeded();
    await b.engine.initIfNeeded();
    writeSession(a.repo, 'a', 's1');
    writeSession(b.repo, 'b', 's1');
    await Promise.all([a.engine.syncOnce(), b.engine.syncOnce()]);
    const final = await Promise.all([a.engine.syncOnce(), b.engine.syncOnce()]);
    expect(final.map((s) => s.state)).toEqual(['synced', 'synced']);
    expect(git(remote, 'ls-tree', '-r', '--name-only', 'main').split('\n').sort()).toEqual(['sessions/a/s1/history.md', 'sessions/b/s1/history.md']);
  });

  it('retries a rejected non-fast-forward push after fetch/rebase', async () => {
    const a = machineRepo('a');
    const b = machineRepo('b');
    writeSession(a.repo, 'a', 's1');
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    writeSession(b.repo, 'b', 's1');
    // A pubblica tra il fetch e il push di B: simulato dal hook su `fetch` di B.
    let injected = false;
    const hooked = new GitEngine({
      repoPath: b.repo,
      machine: 'b',
      remote,
      backoffMs: 1,
      onCommand: (args) => {
        commands.push([...args]);
        if (args[0] === 'push' && !injected) {
          injected = true;
          writeSession(a.repo, 'a', 's2', 'late');
          execFileSync('git', ['add', '--', 'sessions'], { cwd: a.repo });
          execFileSync('git', ['commit', '-m', 'late', '--', 'sessions'], { cwd: a.repo });
          execFileSync('git', ['push', 'origin', 'HEAD:main'], { cwd: a.repo });
        }
      },
    });
    commands = [];
    expect(await hooked.syncOnce()).toMatchObject({ state: 'synced' });
    expect(commands.filter((c) => c[0] === 'push')).toHaveLength(2);
    expect(git(remote, 'ls-tree', '-r', '--name-only', 'main').split('\n').sort()).toEqual([
      'sessions/a/s1/history.md',
      'sessions/a/s2/history.md',
      'sessions/b/s1/history.md',
    ]);
  });

  it('aborts the rebase on conflict, preserves files and reports error', async () => {
    const a = machineRepo('a');
    const b = machineRepo('b');
    writeSession(a.repo, 'a', 's1', 'base');
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    // Stesso file modificato da entrambe le parti (non previsto dal modello, ma deve restare sicuro).
    writeSession(a.repo, 'a', 's1', 'from-a');
    await a.engine.syncOnce();
    const file = writeSession(b.repo, 'a', 's1', 'from-b');
    const status = await b.engine.syncOnce();
    expect(status.state).toBe('error');
    expect(status.lastError).toContain('local session files preserved');
    expect(fs.readFileSync(file, 'utf8')).toBe('from-b');
    expect(fs.existsSync(path.join(b.repo, '.git', 'rebase-merge'))).toBe(false);
    expect(fs.existsSync(path.join(b.repo, '.git', 'rebase-apply'))).toBe(false);
    expect(git(b.repo, 'log', '-1', '--format=%s')).toMatch(/^sessions: b /);
  });

  it('goes offline keeping the local commit, then recovers', async () => {
    const a = machineRepo('a', { remote: path.join(root, 'missing.git') });
    writeSession(a.repo, 'a', 's1');
    const offline = await a.engine.syncOnce();
    expect(offline.state).toBe('offline');
    expect(git(a.repo, 'log', '-1', '--format=%s')).toMatch(/^sessions: a /);
    const recovered = new GitEngine({ repoPath: a.repo, machine: 'a', remote });
    expect(await recovered.syncOnce()).toMatchObject({ state: 'synced' });
    expect(git(remote, 'ls-tree', '-r', '--name-only', 'main')).toBe('sessions/a/s1/history.md');
  });

  it('never creates empty commits and never forces a push', async () => {
    const a = machineRepo('a');
    writeSession(a.repo, 'a', 's1');
    await a.engine.syncOnce();
    await a.engine.syncOnce();
    await a.engine.syncOnce();
    expect(git(a.repo, 'rev-list', '--count', 'HEAD')).toBe('1');
    const flat = commands.flat();
    expect(flat.some((arg) => /^--force|^-f$|^\+|force-with-lease/.test(arg))).toBe(false);
    expect(commands.filter((c) => c[0] === 'push').every((c) => c.join(' ') === 'push origin HEAD:refs/heads/main')).toBe(true);
  });

  it('creates no commit when there are no session files', async () => {
    const a = machineRepo('a');
    expect(await a.engine.syncOnce()).toMatchObject({ state: 'synced' });
    expect(() => git(a.repo, 'rev-parse', '--verify', '--quiet', 'HEAD')).toThrow();
    expect(commands.some((c) => c[0] === 'commit' || c[0] === 'push')).toBe(false);
  });

  it('stages only sessions/ and ignores temporary files', async () => {
    const a = machineRepo('a');
    writeSession(a.repo, 'a', 's1');
    fs.writeFileSync(path.join(a.repo, 'outside.txt'), 'secret');
    fs.writeFileSync(path.join(a.repo, 'sessions', 'a', 's1', '.history.md.1.tmp'), 'tmp');
    git(a.repo, 'init', '-b', 'main');
    git(a.repo, 'add', 'outside.txt'); // anche se staged da altri, il commit usa il pathspec sessions
    await a.engine.syncOnce();
    expect(git(a.repo, 'ls-tree', '-r', '--name-only', 'HEAD')).toBe('sessions/a/s1/history.md');
    expect(git(remote, 'ls-tree', '-r', '--name-only', 'main')).toBe('sessions/a/s1/history.md');
    expect(commands.some((c) => c[0] === 'add' && c.join(' ') !== 'add -- sessions')).toBe(false);
  });

  it('supports a local-only repo without remote', async () => {
    const a = machineRepo('a', { remote: undefined });
    writeSession(a.repo, 'a', 's1');
    expect(await a.engine.syncOnce()).toMatchObject({ state: 'synced' });
    expect(commands.some((c) => c[0] === 'push' || c[0] === 'fetch')).toBe(false);
    expect(git(a.repo, 'rev-list', '--count', 'HEAD')).toBe('1');
  });

  it('serialises concurrent syncOnce calls and reports dirty/syncing states', async () => {
    const states: string[] = [];
    const repo = path.join(root, 'a');
    const engine = new GitEngine({ repoPath: repo, machine: 'a', remote, onStatusChange: (s) => states.push(s.state) });
    writeSession(repo, 'a', 's1');
    engine.markDirty();
    await Promise.all([engine.syncOnce(), engine.syncOnce()]);
    expect(states[0]).toBe('dirty');
    expect(states).toContain('syncing');
    expect(states.at(-1)).toBe('synced');
    expect(git(repo, 'rev-list', '--count', 'HEAD')).toBe('1');
    expect(engine.status.lastSyncAt).toBeDefined();
  });

  it('sanitizes git errors', async () => {
    const a = machineRepo('a', { remote: undefined });
    await a.engine.initIfNeeded();
    fs.writeFileSync(path.join(a.repo, '.git', 'index.lock'), '');
    writeSession(a.repo, 'a', 's1');
    const status = await a.engine.syncOnce();
    expect(status.state).toBe('error');
    expect(status.lastError).not.toContain(root);
  });
});

describe('GitEngine.fetchOnly', () => {
  it('fetches without committing, staging or pushing local files', async () => {
    const a = machineRepo('a');
    const b = machineRepo('b');
    writeSession(a.repo, 'a', 's1', 'from-a');
    await a.engine.syncOnce();
    writeSession(b.repo, 'b', 's2', 'local-b');
    await b.engine.initIfNeeded();
    commands.length = 0;
    const status = await b.engine.fetchOnly();
    expect(status.state).not.toBe('error');
    expect(commands.map((c) => c[0])).toEqual(['fetch']);
    expect(git(b.repo, 'rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main')).toHaveLength(40);
    expect(git(b.repo, 'status', '--porcelain')).toContain('sessions/');
    expect(git(remote, 'ls-tree', '-r', '--name-only', 'main')).toBe('sessions/a/s1/history.md');
  });

  it('is a no-op without a remote', async () => {
    const a = machineRepo('a', { remote: undefined });
    await a.engine.initIfNeeded();
    commands.length = 0;
    expect(await a.engine.fetchOnly()).toMatchObject({ state: 'synced' });
    expect(commands).toEqual([]);
  });

  it('sets offline without losing local files, and recovers to dirty when reachable again', async () => {
    const a = machineRepo('a');
    const file = writeSession(a.repo, 'a', 's1', 'precious');
    await a.engine.syncOnce();
    const moved = `${remote}.moved`;
    fs.renameSync(remote, moved);
    expect(await a.engine.fetchOnly()).toMatchObject({ state: 'offline' });
    expect(fs.readFileSync(file, 'utf8')).toBe('precious');
    fs.renameSync(moved, remote);
    const recovered = await a.engine.fetchOnly();
    expect(recovered.state).toBe('dirty');
    expect(recovered.lastError).toBeUndefined();
  });

  it('serialises with syncOnce', async () => {
    const a = machineRepo('a');
    writeSession(a.repo, 'a', 's1');
    const [, fetched] = await Promise.all([a.engine.syncOnce(), a.engine.fetchOnly()]);
    expect(fetched.state).toBe('synced');
    expect(git(a.repo, 'rev-list', '--count', 'HEAD')).toBe('1');
  });
});

describe('GitEngine.integrateRemote', () => {
  it('integrates remote commits on an idle machine without committing or pushing', async () => {
    const a = machineRepo('a');
    const b = machineRepo('b');
    await a.engine.initIfNeeded();
    writeSession(b.repo, 'b', 's2', 'from-b');
    await b.engine.syncOnce();
    commands.length = 0;
    const result = await a.engine.integrateRemote();
    expect(result.changed).toBe(true);
    expect(result.status.state).toBe('synced');
    expect(fs.readFileSync(path.join(a.repo, 'sessions', 'b', 's2', 'history.md'), 'utf8')).toBe('from-b');
    expect(commands.some((c) => c[0] === 'commit' || c[0] === 'push')).toBe(false);
    expect(git(a.repo, 'rev-parse', 'HEAD')).toBe(git(remote, 'rev-parse', 'main'));
    expect((await a.engine.integrateRemote()).changed).toBe(false);
  });

  it('is a no-op without a remote or while the remote branch does not exist', async () => {
    const local = machineRepo('l', { remote: undefined });
    commands.length = 0;
    expect(await local.engine.integrateRemote()).toMatchObject({ changed: false });
    expect(commands).toEqual([]);
    const a = machineRepo('a');
    expect((await a.engine.integrateRemote()).changed).toBe(false);
  });

  it('does not integrate over uncommitted tracked changes and loses nothing', async () => {
    const a = machineRepo('a');
    const b = machineRepo('b');
    const file = writeSession(a.repo, 'a', 's1', 'v1');
    await a.engine.syncOnce();
    writeSession(b.repo, 'b', 's2', 'from-b');
    await b.engine.syncOnce();
    fs.writeFileSync(file, 'v2-dirty');
    const result = await a.engine.integrateRemote();
    expect(result.changed).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe('v2-dirty');
    expect(fs.existsSync(path.join(a.repo, 'sessions', 'b'))).toBe(false);
    await a.engine.syncOnce();
    expect(fs.existsSync(path.join(a.repo, 'sessions', 'b', 's2', 'history.md'))).toBe(true);
  });

  it('aborts the rebase on conflict, reports error and preserves files', async () => {
    const a = machineRepo('a');
    const b = machineRepo('b');
    const fileA = writeSession(a.repo, 'a', 's1', 'base');
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    fs.writeFileSync(path.join(b.repo, 'sessions', 'a', 's1', 'history.md'), 'remote-change');
    await b.engine.syncOnce();
    // commit locale divergente su A, non pushato
    fs.writeFileSync(fileA, 'local-change');
    git(a.repo, 'add', '--', 'sessions');
    git(a.repo, 'commit', '-m', 'local');
    const result = await a.engine.integrateRemote();
    expect(result.changed).toBe(false);
    expect(result.status.state).toBe('error');
    expect(fs.readFileSync(fileA, 'utf8')).toBe('local-change');
    expect(fs.existsSync(path.join(a.repo, '.git', 'rebase-merge'))).toBe(false);
  });

  it('sets offline and recovers to synced when reachable again', async () => {
    const a = machineRepo('a');
    writeSession(a.repo, 'a', 's1');
    await a.engine.syncOnce();
    const moved = `${remote}.moved`;
    fs.renameSync(remote, moved);
    expect((await a.engine.integrateRemote()).status).toMatchObject({ state: 'offline', lastError: 'Remote unreachable' });
    fs.renameSync(moved, remote);
    const recovered = await a.engine.integrateRemote();
    expect(recovered.status.state).toBe('synced');
    expect(recovered.status.lastError).toBeUndefined();
  });
});

describe('GitSyncManager', () => {
  it('debounces markDirty through the scheduler and exposes status through services', async () => {
    const repo = path.join(root, 'a');
    const manager = new GitSyncManager({ repoPath: repo, machine: 'a', remote, debounceMs: 60, maxWaitMs: 500, fetchIntervalMs: 10_000, onCommand: (args) => commands.push([...args]) });
    await manager.start();
    writeSession(repo, 'a', 's1');
    const services = manager.asServices();
    services.syncDirty();
    services.syncDirty();
    expect(services.syncStatus().state).toBe('dirty');
    expect(commands.some((c) => c[0] === 'commit')).toBe(false);
    await waitUntil(() => services.syncStatus().state === 'synced');
    expect(git(remote, 'ls-tree', '-r', '--name-only', 'main')).toBe('sessions/a/s1/history.md');
    expect(git(repo, 'rev-list', '--count', 'HEAD')).toBe('1');
    await manager.stop();
  });

  it('stop flushes a pending dirty immediately and creates no empty commit', async () => {
    const repo = path.join(root, 'a');
    const manager = new GitSyncManager({ repoPath: repo, machine: 'a', remote });
    await manager.start();
    writeSession(repo, 'a', 's1');
    manager.markDirty();
    await manager.stop();
    expect(manager.status.state).toBe('synced');
    expect(git(remote, 'ls-tree', '-r', '--name-only', 'main')).toBe('sessions/a/s1/history.md');
    manager.markDirty();
    await manager.flush();
    expect(git(repo, 'rev-list', '--count', 'HEAD')).toBe('1');
  });

  it('periodic fetch picks up remote changes without committing local files', async () => {
    const a = machineRepo('a');
    writeSession(a.repo, 'a', 's1');
    await a.engine.syncOnce();
    commands.length = 0;
    const repoB = path.join(root, 'b');
    const manager = new GitSyncManager({ repoPath: repoB, machine: 'b', remote, fetchIntervalMs: 40, onCommand: (args) => commands.push([...args]) });
    await manager.start();
    writeSession(repoB, 'b', 's2');
    await waitUntil(() => commands.some((c) => c[0] === 'fetch'));
    await manager.stop();
    expect(commands.some((c) => c[0] === 'commit' || c[0] === 'push')).toBe(false);
    expect(git(repoB, 'status', '--porcelain')).toContain('sessions/');
  });

  it('periodic fetch integrates remote commits, fires onRemoteIntegrated and never commits or pushes', async () => {
    const a = machineRepo('a');
    writeSession(a.repo, 'a', 's1', 'from-a');
    await a.engine.syncOnce();
    commands.length = 0;
    const repoB = path.join(root, 'b');
    const integrated: { changed: boolean }[] = [];
    const managerCommands: string[][] = [];
    const manager = new GitSyncManager({ repoPath: repoB, machine: 'b', remote, fetchIntervalMs: 40, onCommand: (args) => managerCommands.push([...args]), onRemoteIntegrated: (r) => integrated.push(r) });
    await manager.start();
    await waitUntil(() => integrated.length > 0 || fs.existsSync(path.join(repoB, 'sessions', 'a', 's1', 'history.md')));
    writeSession(a.repo, 'a', 's3', 'second');
    await a.engine.syncOnce();
    await waitUntil(() => fs.existsSync(path.join(repoB, 'sessions', 'a', 's3', 'history.md')));
    await waitUntil(() => integrated.length > 0);
    await manager.stop();
    expect(integrated.every((r) => r.changed)).toBe(true);
    expect(managerCommands.some((c) => c[0] === 'commit' || c[0] === 'push')).toBe(false);
  });

  it('flush at close commits local files even when the remote is offline', async () => {
    const repo = path.join(root, 'a');
    const manager = new GitSyncManager({ repoPath: repo, machine: 'a', remote: path.join(root, 'missing.git'), backoffMs: 1 });
    await manager.start();
    const file = writeSession(repo, 'a', 's1', 'keep');
    manager.markDirty();
    await manager.stop();
    expect(manager.status.state).toBe('offline');
    expect(fs.readFileSync(file, 'utf8')).toBe('keep');
    expect(git(repo, 'rev-list', '--count', 'HEAD')).toBe('1');
  });
});

async function waitUntil(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil timeout');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
