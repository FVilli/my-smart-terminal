import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseClipboardDocument, parseFrontmatter, parseHistoryDocument, parseSessionDocument } from '@smart-terminal/data';
import { DataRuntime } from './data-runtime';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-runtime-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('DataRuntime', () => {
  it('uses env overrides for repo and machine, and userData defaults otherwise', () => {
    const custom = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: { SMART_TERMINAL_DATA_REPO: path.join(root, 'repo'), SMART_TERMINAL_MACHINE: 'My Box' } });
    expect(custom.dataRepoPath).toBe(path.join(root, 'repo'));
    expect(custom.machine).toBe('my-box');
    expect(fs.statSync(path.join(root, 'repo', 'sessions')).isDirectory()).toBe(true);
    const fallback = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: {}, hostname: () => 'Host.Local' });
    expect(fallback.dataRepoPath).toBe(path.join(root, 'ud', 'data'));
    expect(fallback.machine).toBe('host.local');
    expect(fallback.lockDir).toBe(path.join(root, 'ud', 'coordinator', 'locks'));
  });

  it('creates two sessions, writes counter and files, and ends them atomically', async () => {
    const runtime = new DataRuntime({
      userDataPath: path.join(root, 'ud'),
      env: { SMART_TERMINAL_DATA_REPO: path.join(root, 'repo'), SMART_TERMINAL_MACHINE: 'host' },
      clock: () => new Date(2026, 9, 22, 9, 5, 3),
    });
    const [a, b] = await Promise.all([
      runtime.createSession('win-1', { kind: 'local', cwd: '/home/u' }),
      runtime.createSession('win-2', { kind: 'local', cwd: '/tmp' }),
    ]);
    expect([a.allocation.label, b.allocation.label].sort()).toEqual(['S1', 'S2']);
    expect(a.machine).toBe('host');

    const counter = parseFrontmatter(fs.readFileSync(path.join(root, 'repo', 'sessions', 'host', 'counter.md'), 'utf8')).data;
    expect(counter).toMatchObject({ schema_version: 1, machine: 'host', last_session: 2 });

    for (const { allocation } of [a, b]) {
      expect(allocation.absoluteDir.startsWith(path.join(root, 'repo', 'sessions', 'host'))).toBe(true);
      expect(parseHistoryDocument(fs.readFileSync(allocation.historyFile, 'utf8')).header.session_id).toBe(allocation.label);
      expect(parseClipboardDocument(fs.readFileSync(allocation.clipboardFile, 'utf8')).events).toEqual([]);
      const { meta } = parseSessionDocument(fs.readFileSync(allocation.sessionFile, 'utf8'));
      expect(meta).toMatchObject({ session_id: allocation.label, machine: 'host', kind: 'local' });
      expect(meta.ended_at).toBeUndefined();
    }
    expect(parseSessionDocument(fs.readFileSync(a.allocation.sessionFile, 'utf8')).meta.window_id).toBe(a.allocation.label === 'S1' ? 'win-1' : 'win-2');

    expect(runtime.endSession(a.allocation.sessionId)).toBe(true);
    const ended = parseSessionDocument(fs.readFileSync(a.allocation.sessionFile, 'utf8'));
    expect(ended.meta.ended_at).toMatch(/^2026-10-22T09:05:03[+-]\d{2}:\d{2}$/);
    expect(ended.meta.started_at).toBe(a.allocation.startedAt);
    expect(fs.readdirSync(a.allocation.absoluteDir).sort()).toEqual(['clipboard.md', 'history.md', 'session.md']);
    expect(runtime.endSession(a.allocation.sessionId)).toBe(false);
    expect(parseSessionDocument(fs.readFileSync(b.allocation.sessionFile, 'utf8')).meta.ended_at).toBeUndefined();
  });

  it('creates ssh sessions with ssh_alias in session.md', async () => {
    const runtime = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: { SMART_TERMINAL_DATA_REPO: path.join(root, 'repo'), SMART_TERMINAL_MACHINE: 'host' } });
    const { allocation } = await runtime.createSession('w', { kind: 'ssh', sshAlias: 'prod-1', cwd: '/home/u' });
    const { meta } = parseSessionDocument(fs.readFileSync(allocation.sessionFile, 'utf8'));
    expect(meta).toMatchObject({ kind: 'ssh', ssh_alias: 'prod-1' });
    expect(allocation.relativeDir).toContain('prod-1');
  });
});
