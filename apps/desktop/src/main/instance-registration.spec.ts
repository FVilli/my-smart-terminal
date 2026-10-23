import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstanceRegistrar } from './instance-registration';

let root = '';
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-instance-registration-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const installationId = '00000000-0000-4000-8000-000000000001';
function registrar(remote?: string, clock?: () => Date) {
  return new InstanceRegistrar({
    dataRepoPath: path.join(root, 'data'),
    ...(remote !== undefined ? { remote } : {}),
    machine: 'host',
    installationId,
    installationCreatedAt: '2026-10-23T00:00:00.000Z',
    appVersion: '1.0.0',
    platform: 'linux',
    arch: 'x64',
    ...(clock !== undefined ? { clock } : {}),
  });
}

describe('InstanceRegistrar', () => {
  it('commits and pushes the registration to a local bare remote', async () => {
    const bare = path.join(root, 'remote.git');
    execFileSync('git', ['init', '--bare', bare]);
    const result = await registrar(bare).register();
    expect(result).toMatchObject({ ok: true, committed: true, pushed: true, localOnly: false, path: `instances/host-${installationId}.md` });
    const files = execFileSync('git', ['--git-dir', bare, 'ls-tree', '-r', '--name-only', 'main'], { encoding: 'utf8' });
    expect(files).toContain(`instances/host-${installationId}.md`);
    const content = execFileSync('git', ['--git-dir', bare, 'show', `main:instances/host-${installationId}.md`], { encoding: 'utf8' });
    expect(content).toContain(`instance_id: "${installationId}"`);
    expect(content).not.toContain('token');
  });

  it('updates the same registration on a repeated test', async () => {
    const times = [new Date('2026-10-23T00:00:00Z'), new Date('2026-10-23T00:01:00Z')];
    let index = 0;
    const first = await registrar(undefined, () => times[index++] ?? times[1]!).register();
    const second = await registrar(undefined, () => times[index++] ?? times[1]!).register();
    expect(first.committed).toBe(true);
    expect(second.committed).toBe(true);
    expect(second.localOnly).toBe(true);
    expect(fs.readdirSync(path.join(root, 'data', 'instances')).filter((name) => name.endsWith('.md'))).toHaveLength(1);
  });

  it('keeps a local commit when the remote push fails, with a recoverable error', async () => {
    const result = await registrar(path.join(root, 'missing-remote.git')).register();
    expect(result).toMatchObject({ ok: false, committed: true, pushed: false, state: 'offline' });
    expect(result.error).toBeTruthy();
  });

  it('refuses tracked changes outside sessions/ and instances/', async () => {
    const repo = path.join(root, 'data');
    execFileSync('git', ['init', '-b', 'main', repo]);
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: repo });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
    fs.writeFileSync(path.join(repo, 'outside.txt'), 'dirty\n');
    execFileSync('git', ['add', 'outside.txt'], { cwd: repo });
    execFileSync('git', ['commit', '-m', 'outside'], { cwd: repo });
    fs.writeFileSync(path.join(repo, 'outside.txt'), 'dirty changed\n');
    const result = await registrar().register();
    expect(result).toMatchObject({ ok: false, committed: false, state: 'error' });
    expect(result.error).toMatch(/outside sessions\/ and instances\//);
  });
});
