import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { PtyAdapter, PtyExitInfo, PtyProcessLike, PtySpawnOptions } from './pty';
import { MAX_WRITE_BYTES, SessionManager, TerminalError } from './session-manager';
import { buildLocalShellCommand } from './shell';

class FakePty implements PtyProcessLike {
  readonly written: string[] = [];
  readonly resizes: Array<[number, number]> = [];
  killed = 0;
  private dataListeners: Array<(d: string) => void> = [];
  private exitListeners: Array<(i: PtyExitInfo) => void> = [];
  constructor(readonly pid: number) {}
  write(data: string): void {
    this.written.push(data);
  }
  resize(cols: number, rows: number): void {
    this.resizes.push([cols, rows]);
  }
  kill(): void {
    this.killed += 1;
    this.emitExit({ exitCode: 0, signal: 15 });
  }
  onData(l: (d: string) => void): void {
    this.dataListeners.push(l);
  }
  onExit(l: (i: PtyExitInfo) => void): void {
    this.exitListeners.push(l);
  }
  emitData(d: string): void {
    this.dataListeners.forEach((l) => l(d));
  }
  emitExit(i: PtyExitInfo): void {
    this.exitListeners.forEach((l) => l(i));
  }
}

class FakePtyAdapter implements PtyAdapter {
  readonly spawned: Array<{ options: PtySpawnOptions; pty: FakePty }> = [];
  spawn(options: PtySpawnOptions): PtyProcessLike {
    const pty = new FakePty(100 + this.spawned.length);
    this.spawned.push({ options, pty });
    return pty;
  }
}

function setup() {
  const adapter = new FakePtyAdapter();
  let n = 0;
  let t = 0;
  const manager = new SessionManager({
    adapter,
    generateId: () => `s${++n}`,
    clock: () => ++t,
    env: { SHELL: '/nonexistent/shell', PATH: '/bin' },
    platform: 'linux',
    homeDirectory: () => os.tmpdir(),
  });
  return { adapter, manager };
}

describe('buildLocalShellCommand', () => {
  it('uses absolute executable $SHELL and sets terminal env', () => {
    const cmd = buildLocalShellCommand({ SHELL: '/usr/bin/zsh', FOO: 'x' }, 'linux', () => true);
    expect(cmd.file).toBe('/usr/bin/zsh');
    expect(cmd.args).toEqual([]);
    expect(cmd.env).toMatchObject({ FOO: 'x', TERM: 'xterm-256color', COLORTERM: 'truecolor' });
  });
  it('falls back for relative, non-executable or missing $SHELL', () => {
    expect(buildLocalShellCommand({ SHELL: 'zsh' }, 'linux', () => true).file).toBe('/bin/bash');
    expect(buildLocalShellCommand({ SHELL: '/x/zsh' }, 'linux', () => false).file).toBe('/bin/bash');
    expect(buildLocalShellCommand({}, 'linux', () => true).file).toBe('/bin/bash');
  });
  it('uses powershell on win32', () => {
    expect(buildLocalShellCommand({ SHELL: '/bin/zsh' }, 'win32', () => true).file).toBe('powershell.exe');
  });
});

describe('SessionManager', () => {
  it('uses an explicit session id and rejects duplicates', () => {
    const { manager } = setup();
    expect(manager.create({ kind: 'local' }, 'S7').sessionId).toBe('S7');
    expect(() => manager.create({ kind: 'local' }, 'S7')).toThrow('TERMINAL_SPAWN_FAILED');
    expect(manager.create({ kind: 'local' }).sessionId).toBe('s1');
  });

  it('creates a session and forwards output', () => {
    const { adapter, manager } = setup();
    const onData = vi.fn();
    manager.on('data', onData);
    const info = manager.create({ kind: 'local' });
    expect(info).toEqual({ sessionId: 's1', kind: 'local', pid: 100, cwd: os.tmpdir() });
    expect(adapter.spawned[0]?.options).toMatchObject({ file: '/bin/bash', args: [], cols: 80, rows: 24 });
    adapter.spawned[0]?.pty.emitData('hello');
    expect(onData).toHaveBeenCalledWith({ sessionId: 's1', data: 'hello' });
    expect(manager.list()).toEqual([info]);
  });

  it('writes and resizes', () => {
    const { adapter, manager } = setup();
    const { sessionId } = manager.create({ kind: 'local' });
    manager.write(sessionId, 'ls\n');
    manager.resize(sessionId, 120, 40);
    expect(adapter.spawned[0]?.pty.written).toEqual(['ls\n']);
    expect(adapter.spawned[0]?.pty.resizes).toEqual([[120, 40]]);
  });

  it('rejects oversize data, invalid dimensions and unknown sessions', () => {
    const { manager } = setup();
    const { sessionId } = manager.create({ kind: 'local' });
    expect(() => manager.write(sessionId, 'a'.repeat(MAX_WRITE_BYTES + 1))).toThrow('TERMINAL_DATA_TOO_LARGE');
    manager.write(sessionId, 'a'.repeat(MAX_WRITE_BYTES));
    for (const [c, r] of [[0, 10], [10, 0], [1001, 10], [10, 1001], [1.5, 10], [Number.NaN, 10]] as const) {
      expect(() => manager.resize(sessionId, c, r)).toThrow('TERMINAL_INVALID_DIMENSIONS');
    }
    expect(() => manager.create({ kind: 'local', cols: 0 })).toThrow('TERMINAL_INVALID_DIMENSIONS');
    expect(() => manager.write('nope', 'x')).toThrow(TerminalError);
    expect(() => manager.resize('nope', 10, 10)).toThrow('TERMINAL_UNKNOWN_SESSION');
    expect(() => manager.close('nope')).toThrow('TERMINAL_UNKNOWN_SESSION');
  });

  it('notifies exit once, removes session and ignores later calls', () => {
    const { adapter, manager } = setup();
    const onExit = vi.fn();
    const onData = vi.fn();
    manager.on('exit', onExit);
    manager.on('data', onData);
    const { sessionId } = manager.create({ kind: 'local' });
    const pty = adapter.spawned[0]!.pty;
    pty.emitExit({ exitCode: 3 });
    pty.emitExit({ exitCode: 3 });
    pty.emitData('late');
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith({ sessionId, exitCode: 3 });
    expect(onData).not.toHaveBeenCalled();
    expect(manager.list()).toEqual([]);
    expect(() => manager.write(sessionId, 'x')).toThrow('TERMINAL_UNKNOWN_SESSION');
  });

  it('close kills the process and emits a single exit', () => {
    const { adapter, manager } = setup();
    const onExit = vi.fn();
    manager.on('exit', onExit);
    const { sessionId } = manager.create({ kind: 'local' });
    manager.close(sessionId);
    expect(adapter.spawned[0]?.pty.killed).toBe(1);
    expect(onExit).toHaveBeenCalledWith({ sessionId, exitCode: 0, signal: 15 });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('closeAll terminates every session', () => {
    const { adapter, manager } = setup();
    manager.create({ kind: 'local' });
    manager.create({ kind: 'local' });
    manager.closeAll();
    expect(adapter.spawned.map((s) => s.pty.killed)).toEqual([1, 1]);
    expect(manager.list()).toEqual([]);
  });

  it('validates cwd', () => {
    const { manager } = setup();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-cwd-'));
    const file = path.join(dir, 'f.txt');
    fs.writeFileSync(file, 'x');
    try {
      expect(manager.create({ kind: 'local', cwd: dir }).cwd).toBe(dir);
      for (const cwd of ['relative/dir', path.join(dir, 'missing'), file]) {
        expect(() => manager.create({ kind: 'local', cwd })).toThrow('TERMINAL_INVALID_CWD');
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sanitizes spawn failures', () => {
    const manager = new SessionManager({
      adapter: {
        spawn: () => {
          throw new Error('/secret/path failed');
        },
      },
      homeDirectory: () => os.tmpdir(),
    });
    expect(() => manager.create({ kind: 'local' })).toThrow(/^TERMINAL_SPAWN_FAILED$/);
  });
});
