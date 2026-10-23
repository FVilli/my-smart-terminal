import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resetSmokeData, SMOKE_DATA_DIR } from './reset-smoke-data.mjs';

// Prepares userData/config with the `local` STT provider and an absolute command (the Node executable itself):
// no token, no network. The smoke test replaces getUserMedia and uses SMART_TERMINAL_STT_TEST_MODE.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-stt-smoke-'));
const userData = path.join(root, 'ud');
const repo = path.join(root, 'data');
const command = process.execPath;
fs.mkdirSync(path.join(userData, 'config'), { recursive: true });
fs.mkdirSync(path.join(repo, 'sessions'), { recursive: true });

fs.writeFileSync(
  path.join(userData, 'config', 'config.md'),
  [
    '---',
    'schema_version: 1',
    'machine_name: "stt-smoke"',
    `data_repo_path: "${repo.replaceAll('\\', '/')}"`,
    'ai_provider: "none"',
    'stt_provider: "local"',
    `stt_command: "${command.replaceAll('\\', '/')}"`,
    '---',
    '',
    '# Config smoke STT',
    '',
  ].join('\n'),
  'utf8',
);

const baseEnv = { ...process.env };
for (const key of Object.keys(baseEnv)) {
  if (key.startsWith('SMART_TERMINAL_') && key !== 'SMART_TERMINAL_XVFB_BIN') delete baseEnv[key];
}

resetSmokeData();
const result = spawnSync('node', ['scripts/run-electron.mjs', 'apps/desktop'], {
  stdio: 'inherit',
  env: {
    ...baseEnv,
    SMART_TERMINAL_USER_DATA: userData,
    SMART_TERMINAL_DATA_REPO: SMOKE_DATA_DIR,
    SMART_TERMINAL_STT_TEST_MODE: '1',
    SMART_TERMINAL_STT_SMOKE: '1',
  },
});

const artifacts = fs
  .readdirSync(userData, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(webm|wav|mp3|ogg|m4a|aac|flac|opus)$/i.test(entry.name));
if (artifacts.length > 0) {
  console.error('[stt-smoke] trovato un file audio nella userData', artifacts.map((entry) => entry.name));
}

fs.rmSync(root, { recursive: true, force: true });
process.exit(result.status === 0 && artifacts.length === 0 ? 0 : 1);
