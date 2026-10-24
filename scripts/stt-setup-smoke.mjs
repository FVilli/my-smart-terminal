import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-stt-setup-'));
const userData = path.join(root, 'ud');
const repo = path.join(root, 'data');
fs.mkdirSync(path.join(userData, 'config'), { recursive: true });
fs.mkdirSync(path.join(repo, 'sessions'), { recursive: true });
fs.writeFileSync(path.join(userData, 'config', 'config.md'), [
  '---',
  'schema_version: 1',
  'machine_name: "stt-setup-smoke"',
  `data_repo_path: "${repo.replaceAll('\\', '/')}"`,
  'ai_provider: "openai-compatible"',
  'ai_base_url: "https://stt.test/v1"',
  'ai_model: "test-model"',
  'stt_provider: "cloud"',
  'stt_use_ai_provider: true',
  'stt_model: "audio-cpp/audio.cpp-gguf/Parakeet-TDT-0.6B-v3-GGUF"',
  'stt_language: "en"',
  '---',
  '',
  '# Configuration',
  '',
].join('\n'));
const baseEnv = { ...process.env };
for (const key of Object.keys(baseEnv)) if (key.startsWith('SMART_TERMINAL_') && key !== 'SMART_TERMINAL_XVFB_BIN') delete baseEnv[key];
const run = spawnSync(process.execPath, ['scripts/run-electron.mjs', 'apps/desktop'], {
  stdio: 'inherit',
  env: { ...baseEnv, SMART_TERMINAL_USER_DATA: userData, SMART_TERMINAL_DATA_REPO: repo, SMART_TERMINAL_STT_TEST_MODE: '1', SMART_TERMINAL_STT_SETUP_SMOKE: '1' },
});
const artifacts = fs.readdirSync(userData, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile() && /\.(webm|wav|mp3|ogg|m4a|aac|flac|opus)$/i.test(entry.name));
if (artifacts.length > 0) console.error('[stt-setup-smoke] found audio files', artifacts.map((entry) => entry.name));
fs.rmSync(root, { recursive: true, force: true });
process.exit(run.status === 0 && artifacts.length === 0 ? 0 : 1);
