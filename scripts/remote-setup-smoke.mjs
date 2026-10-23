import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-remote-setup-'));
const userData = path.join(root, 'ud');
const repo = path.join(root, 'data');
const bare = path.join(root, 'remote.git');
fs.mkdirSync(path.join(userData, 'config'), { recursive: true });
fs.mkdirSync(repo, { recursive: true });
execFileSync('git', ['init', '--bare', bare]);
fs.writeFileSync(path.join(userData, 'config', 'config.md'), [
  '---',
  'schema_version: 1',
  'machine_name: "remote-smoke"',
  `data_repo_path: "${repo.replaceAll('\\', '/')}"`,
  `data_repo_remote: "${bare.replaceAll('\\', '/')}"`,
  'ai_provider: "none"',
  'stt_provider: "none"',
  '---',
  '',
  '# Configuration',
  '',
].join('\n'));
const baseEnv = { ...process.env };
for (const key of Object.keys(baseEnv)) if (key.startsWith('SMART_TERMINAL_') && key !== 'SMART_TERMINAL_XVFB_BIN') delete baseEnv[key];
const run = spawnSync(process.execPath, ['scripts/run-electron.mjs', 'apps/desktop'], {
  stdio: 'inherit',
  env: { ...baseEnv, SMART_TERMINAL_USER_DATA: userData, SMART_TERMINAL_DATA_REPO: repo, SMART_TERMINAL_GIT_REMOTE: bare, SMART_TERMINAL_REMOTE_SETUP_SMOKE: '1', SMART_TERMINAL_REMOTE_SETUP_BARE: bare },
});
fs.rmSync(root, { recursive: true, force: true });
process.exit(run.status === 0 ? 0 : 1);
