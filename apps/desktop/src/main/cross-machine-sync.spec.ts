import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SearchRefreshedEvent } from '@smart-terminal/contracts';
import { CoordinatorRuntime } from './coordinator-runtime';
import { DataRuntime } from './data-runtime';
import { HistoryService } from './history-service';

let root: string;
let remote: string;
const runtimes: CoordinatorRuntime[] = [];

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-xmachine-'));
  remote = path.join(root, 'remote.git');
  execFileSync('git', ['init', '--bare', '-b', 'main', remote]);
});
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.stop()));
  fs.rmSync(root, { recursive: true, force: true });
});

function machine(name: string) {
  const userDataPath = path.join(root, `${name}-ud`);
  const env = {
    SMART_TERMINAL_DATA_REPO: path.join(root, `${name}-repo`),
    SMART_TERMINAL_MACHINE: name,
    SMART_TERMINAL_GIT_REMOTE: remote,
    SMART_TERMINAL_SYNC_DEBOUNCE_MS: '40',
    SMART_TERMINAL_SYNC_MAX_WAIT_MS: '200',
    SMART_TERMINAL_SYNC_FETCH_INTERVAL_MS: '150',
  };
  const runtime = new CoordinatorRuntime({ userDataPath, env, clipboardSource: { readText: () => '' } });
  runtimes.push(runtime);
  return { runtime, userDataPath, env };
}

const eventually = async <T>(read: () => Promise<T> | T, accept: (value: T) => boolean, timeoutMs = 15_000): Promise<T> => {
  const start = Date.now();
  for (;;) {
    const value = await read();
    if (accept(value)) return value;
    if (Date.now() - start > timeoutMs) throw new Error('eventually timeout');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

describe('cross-machine sync -> search', () => {
  it('machine B finds the prompt written on machine A after the Git pull and is notified of the refresh', async () => {
    const a = machine('alpha');
    const b = machine('beta');
    await a.runtime.start();
    await b.runtime.start();
    const refreshes: SearchRefreshedEvent[] = [];
    b.runtime.onSearchRefreshed((event) => refreshes.push(event));

    expect((await b.runtime.query({ query: 'needle-from-alpha' })).entries).toEqual([]);

    const data = new DataRuntime({ userDataPath: a.userDataPath, env: a.env, allocator: a.runtime.allocator });
    const { allocation } = await data.createSession('w1', { kind: 'local', cwd: '/tmp' });
    const history = new HistoryService({
      dataRepoPath: data.dataRepoPath,
      resolveSession: () => ({ sessionDirectory: allocation.relativeDir }),
      onRecorded: (dir) => a.runtime.notifyWrite(dir),
    });
    history.record(1, { sessionId: allocation.sessionId, text: 'echo needle-from-alpha' });

    await eventually(
      () => {
        try {
          return execFileSync('git', ['ls-tree', '-r', '--name-only', 'main'], { cwd: remote, encoding: 'utf8', stdio: 'pipe' });
        } catch {
          return ''; // il branch remoto non esiste ancora
        }
      },
      (files) => files.includes('history.md'),
    );

    // Il pull avviene nel ciclo di sync di B (scatenato da una sua scrittura): poi il primary riallinea l'indice.
    const dataB = new DataRuntime({ userDataPath: b.userDataPath, env: b.env, allocator: b.runtime.allocator });
    const sessionB = await dataB.createSession('w2', { kind: 'local', cwd: '/tmp' });
    b.runtime.notifyWrite(sessionB.allocation.relativeDir);

    const result = await eventually(
      () => b.runtime.query({ query: 'NEEDLE-FROM-ALPHA' }),
      (value) => value.entries.length === 1,
    );
    expect(result.entries[0]).toMatchObject({ machine: 'alpha', kind: 'history', source: 'assisted' });
    expect(refreshes.length).toBeGreaterThan(0);
    expect((await b.runtime.searchFacets()).machines).toContain('alpha');
    expect((await b.runtime.query({ query: 'needle-from-alpha', machine: 'beta' })).entries).toEqual([]);
    expect(await b.runtime.syncStatus()).toMatchObject({ remoteConfigured: true });
  });

  it('an idle machine sees the remote prompt through the periodic fetch, with a single search:refreshed', async () => {
    const a = machine('alpha');
    const b = machine('beta');
    await a.runtime.start();
    await b.runtime.start();
    const refreshes: SearchRefreshedEvent[] = [];
    b.runtime.onSearchRefreshed((event) => refreshes.push(event));

    const data = new DataRuntime({ userDataPath: a.userDataPath, env: a.env, allocator: a.runtime.allocator });
    const { allocation } = await data.createSession('w1', { kind: 'local', cwd: '/tmp' });
    const history = new HistoryService({
      dataRepoPath: data.dataRepoPath,
      resolveSession: () => ({ sessionDirectory: allocation.relativeDir }),
      onRecorded: (dir) => a.runtime.notifyWrite(dir),
    });
    history.record(1, { sessionId: allocation.sessionId, text: 'echo idle-needle' });

    // beta non scrive mai: solo il fetch periodico integra e riallinea l'indice
    const result = await eventually(
      () => b.runtime.query({ query: 'idle-needle' }),
      (value) => value.entries.length === 1,
    );
    expect(result.entries[0]).toMatchObject({ machine: 'alpha' });
    expect((await b.runtime.searchFacets()).machines).toContain('alpha');
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(refreshes).toHaveLength(1);
  });
});
