import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-ai-smoke-'));
const userData = path.join(root, 'ud');
const repo = path.join(root, 'data');
fs.mkdirSync(path.join(userData, 'config'), { recursive: true });
fs.mkdirSync(path.join(repo, 'sessions'), { recursive: true });

fs.writeFileSync(
  path.join(userData, 'config', 'config.md'),
  [
    '---',
    'schema_version: 1',
    `machine_name: "ai-smoke"`,
    `data_repo_path: "${repo.replaceAll('\\', '/')}"`,
    'ai_provider: "openai-compatible"',
    'ai_base_url: "https://ai.test/v1"',
    'ai_model: "test-model"',
    'stt_provider: "none"',
    '---',
    '',
    '# Config smoke AI',
    '',
  ].join('\n'),
  'utf8',
);

const baseEnv = { ...process.env };
for (const key of Object.keys(baseEnv)) {
  if (key.startsWith('SMART_TERMINAL_') && key !== 'SMART_TERMINAL_XVFB_BIN') delete baseEnv[key];
}

const result = spawnSync('node', ['scripts/run-electron.mjs', 'apps/desktop'], {
  stdio: 'inherit',
  env: {
    ...baseEnv,
    SMART_TERMINAL_USER_DATA: userData,
    SMART_TERMINAL_DATA_REPO: repo,
    SMART_TERMINAL_AI_TEST_MODE: '1',
    SMART_TERMINAL_AI_SMOKE: '1',
  },
});

fs.rmSync(root, { recursive: true, force: true });
process.exit(result.status === 0 ? 0 : 1);
