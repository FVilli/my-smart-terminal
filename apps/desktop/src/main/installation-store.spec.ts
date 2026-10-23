import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { InstallationStore } from './installation-store';

let root = '';
afterEach(() => { if (root) fs.rmSync(root, { recursive: true, force: true }); });

describe('InstallationStore', () => {
  it('persists the same UUID and creation time across restarts', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-installation-'));
    const first = new InstallationStore(root).loadOrCreate();
    const second = new InstallationStore(root).loadOrCreate();
    expect(second).toEqual(first);
    const markdown = fs.readFileSync(path.join(root, 'installation.md'), 'utf8');
    expect(markdown).toContain('schema_version: 1');
    expect(markdown).not.toContain('token');
  });
});
