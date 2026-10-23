import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PtyAdapter, PtyProcessLike } from './pty';
import { SessionManager, TerminalError } from './session-manager';

/** Adapter di test: avvia davvero il binario (file + args) con child_process, senza PTY. */
const childProcessAdapter: PtyAdapter = {
  spawn(options): PtyProcessLike {
    const child = spawn(options.file, options.args, { env: options.env, cwd: options.cwd, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    return {
      pid: child.pid ?? 0,
      write: (data) => void child.stdin.write(data),
      resize: () => undefined,
      kill: () => void child.kill(),
      onData: (listener) => {
        child.stdout.on('data', (chunk: Buffer) => listener(chunk.toString('utf8')));
        child.stderr.on('data', (chunk: Buffer) => listener(chunk.toString('utf8')));
      },
      onExit: (listener) => void child.on('exit', (code, signal) => listener({ exitCode: code ?? 0, ...(signal !== null ? { signal: 1 } : {}) })),
    };
  },
};

let root: string;
let fakeSsh: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-ssh-session-'));
  fakeSsh = path.join(root, 'fake-ssh');
  fs.writeFileSync(
    fakeSsh,
    '#!/bin/sh\necho "FAKE_SSH argc=$# args=$*"\necho "AUTH=${SSH_AUTH_SOCK:+present}"\nif [ "$1" = fail-host ]; then exit 255; fi\nexec sleep 3\n',
    { mode: 0o755 },
  );
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

describe('SessionManager ssh sessions', () => {
  it('spawns the fake ssh with only the alias and the agent socket in the environment', async () => {
    const manager = new SessionManager({
      adapter: childProcessAdapter,
      env: { SSH_AUTH_SOCK: '/tmp/agent.sock', PATH: process.env['PATH'] ?? '', SMART_TERMINAL_SSH_BINARY: fakeSsh },
      homeDirectory: () => root,
    });
    let output = '';
    manager.on('data', (event) => (output += event.data));
    const info = manager.create({ kind: 'ssh', sshAlias: 'prod-1' }, 'S7');
    expect(info).toMatchObject({ sessionId: 'S7', kind: 'ssh', target: 'prod-1', cwd: root });
    await waitFor(() => output.includes('AUTH='));
    expect(output).toContain('FAKE_SSH argc=1 args=prod-1');
    expect(output).toContain('AUTH=present');
    expect(manager.list()).toHaveLength(1);
    manager.closeAll();
  });

  it('reports ssh failure as an exit event without affecting other sessions', async () => {
    const manager = new SessionManager({
      adapter: childProcessAdapter,
      env: { PATH: process.env['PATH'] ?? '', SMART_TERMINAL_SSH_BINARY: fakeSsh },
      homeDirectory: () => root,
    });
    const exits: string[] = [];
    manager.on('exit', (event) => exits.push(`${event.sessionId}:${event.exitCode}`));
    manager.create({ kind: 'ssh', sshAlias: 'ok-host' }, 'S1');
    manager.create({ kind: 'ssh', sshAlias: 'fail-host' }, 'S2');
    await waitFor(() => exits.length > 0);
    expect(exits).toEqual(['S2:255']);
    expect(manager.list().map((s) => s.sessionId)).toEqual(['S1']);
    manager.closeAll();
  });

  it('rejects invalid ssh requests', () => {
    const manager = new SessionManager({ adapter: childProcessAdapter, env: {}, homeDirectory: () => root });
    for (const request of [
      { kind: 'ssh' as const },
      { kind: 'ssh' as const, sshAlias: '-oProxyCommand=x' },
      { kind: 'ssh' as const, sshAlias: 'a b' },
      { kind: 'ssh' as const, sshAlias: 'ok', cwd: root },
      { kind: 'local' as const, sshAlias: 'ok' },
    ]) {
      expect(() => manager.prepare(request)).toThrow(TerminalError);
    }
  });

  it('maps an adapter spawn failure to a spawn error', () => {
    const manager = new SessionManager({
      adapter: {
        spawn: () => {
          throw new Error('boom');
        },
      },
      env: {},
      homeDirectory: () => root,
    });
    expect(() => manager.create({ kind: 'ssh', sshAlias: 'a' })).toThrow('TERMINAL_SPAWN_FAILED');
  });
});
