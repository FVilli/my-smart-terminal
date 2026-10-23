import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { WebContents } from 'electron';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseSessionDocument } from '@smart-terminal/data';
import type { PtyAdapter, PtyExitInfo, PtyProcessLike, PtySpawnOptions } from '@smart-terminal/terminal';
import { DataRuntime } from './data-runtime';
import { TerminalHost } from './terminal-host';

class FakePty implements PtyProcessLike {
  private exitListeners: Array<(i: PtyExitInfo) => void> = [];
  constructor(readonly pid: number) {}
  write(): void {}
  resize(): void {}
  kill(): void {
    this.exitListeners.forEach((l) => l({ exitCode: 0 }));
  }
  onData(): void {}
  onExit(l: (i: PtyExitInfo) => void): void {
    this.exitListeners.push(l);
  }
}

class FakeAdapter implements PtyAdapter {
  failNext = false;
  private n = 0;
  spawn(_options: PtySpawnOptions): PtyProcessLike {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('/secret/path spawn failure');
    }
    this.n += 1;
    return new FakePty(500 + this.n);
  }
}

let root: string;
let adapter: FakeAdapter;
let host: TerminalHost;
const sent: Array<[string, unknown]> = [];

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-host-'));
  adapter = new FakeAdapter();
  sent.length = 0;
  const runtime = new DataRuntime({
    userDataPath: path.join(root, 'ud'),
    env: { SMART_TERMINAL_DATA_REPO: path.join(root, 'repo'), SMART_TERMINAL_MACHINE: 'host' },
  });
  host = new TerminalHost(adapter, runtime);
  host.attach({
    id: 1,
    once: () => undefined,
    isDestroyed: () => false,
    send: (channel: string, payload: unknown) => sent.push([channel, payload]),
  } as unknown as WebContents);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const sessionFile = (info: { sessionDirectory: string }): string => path.join(root, 'repo', info.sessionDirectory, 'session.md');

describe('TerminalHost', () => {
  it('creates sessions with S<n> ids, files and metadata; ends them on close', async () => {
    const a = await host.create(1, { kind: 'local', cwd: root });
    const b = await host.create(1, { kind: 'local', cwd: root });
    expect([a.sessionId, b.sessionId]).toEqual(['S1', 'S2']);
    expect(a).toMatchObject({ label: 'S1', machine: 'host', kind: 'local', cwd: root });
    expect(a.sessionDirectory).toMatch(/^sessions\/host\/\d{4}-\d{2}-\d{2}_\d{2}\.\d{2}_S1_local$/);
    expect(host.list(1).map((s) => s.label)).toEqual(['S1', 'S2']);
    const meta = parseSessionDocument(fs.readFileSync(sessionFile(a), 'utf8')).meta;
    expect(meta).toMatchObject({ session_id: 'S1', cwd_initial: root });
    expect(meta.window_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(parseSessionDocument(fs.readFileSync(sessionFile(b), 'utf8')).meta.window_id).toBe(meta.window_id);

    host.close(1, 'S1');
    expect(parseSessionDocument(fs.readFileSync(sessionFile(a), 'utf8')).meta.ended_at).toBeDefined();
    expect(parseSessionDocument(fs.readFileSync(sessionFile(b), 'utf8')).meta.ended_at).toBeUndefined();
    expect(sent.some(([channel]) => channel === 'terminal:exit')).toBe(true);
    expect(host.list(1).map((s) => s.label)).toEqual(['S2']);

    host.closeAll();
    expect(parseSessionDocument(fs.readFileSync(sessionFile(b), 'utf8')).meta.ended_at).toBeDefined();
  });

  it('finalizes ended_at and returns a sanitized error when the PTY spawn fails', async () => {
    adapter.failNext = true;
    await expect(host.create(1, { kind: 'local', cwd: root })).rejects.toThrow('TERMINAL_SPAWN_FAILED');
    const dirs = fs.readdirSync(path.join(root, 'repo', 'sessions', 'host')).filter((n) => n !== 'counter.md');
    expect(dirs).toHaveLength(1);
    const file = path.join(root, 'repo', 'sessions', 'host', dirs[0]!, 'session.md');
    expect(parseSessionDocument(fs.readFileSync(file, 'utf8')).meta.ended_at).toBeDefined();
    expect(fs.readdirSync(path.dirname(file)).sort()).toEqual(['clipboard.md', 'history.md', 'session.md']);
    expect(host.list(1)).toEqual([]);
    const next = await host.create(1, { kind: 'local', cwd: root });
    expect(next.sessionId).toBe('S2');
  });

  it('does not allocate when the request is invalid', async () => {
    await expect(host.create(1, { kind: 'local', cwd: '/definitely/not/here' })).rejects.toThrow('TERMINAL_INVALID_CWD');
    await expect(host.create(1, { kind: 'local', cols: 0 })).rejects.toThrow('TERMINAL_INVALID_DIMENSIONS');
    expect(fs.readdirSync(path.join(root, 'repo', 'sessions'))).toEqual([]);
  });

  it('creates ssh sessions: session.md carries ssh_alias and info exposes kind/target; a failed ssh does not block local tabs', async () => {
    const ssh = await host.create(1, { kind: 'ssh', sshAlias: 'prod-1' });
    expect(ssh).toMatchObject({ kind: 'ssh', target: 'prod-1', label: 'S1' });
    const sessionFile = path.join(root, 'repo', ssh.sessionDirectory, 'session.md');
    expect(parseSessionDocument(fs.readFileSync(sessionFile, 'utf8')).meta).toMatchObject({ kind: 'ssh', ssh_alias: 'prod-1' });
    adapter.failNext = true;
    await expect(host.create(1, { kind: 'ssh', sshAlias: 'broken' })).rejects.toThrow('TERMINAL_SPAWN_FAILED');
    const local = await host.create(1, { kind: 'local' });
    expect(local).toMatchObject({ kind: 'local', target: 'local' });
    expect(host.list(1).map((info) => info.target)).toEqual(['prod-1', 'local']);
  });
});
