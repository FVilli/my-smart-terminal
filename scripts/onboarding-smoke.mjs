import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Tre avvii: `first` (wizard completo), `second` (stessa userData: niente wizard, config applicata), `skip` (userData nuova).
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-onboarding-smoke-'));
const repo = path.join(root, 'repo data');
const machine = 'Smoke Box';
const token = `sk-onboarding-smoke-${Date.now()}`;

const baseEnv = { ...process.env };
for (const key of Object.keys(baseEnv)) {
  if (key.startsWith('SMART_TERMINAL_') && key !== 'SMART_TERMINAL_XVFB_BIN') delete baseEnv[key];
}

function run(phase, userData) {
  const result = spawnSync('node', ['scripts/run-electron.mjs', 'apps/desktop'], {
    stdio: 'inherit',
    env: {
      ...baseEnv,
      SMART_TERMINAL_USER_DATA: userData,
      SMART_TERMINAL_ONBOARDING_SMOKE: '1',
      SMART_TERMINAL_ONBOARDING_PHASE: phase,
      SMART_TERMINAL_ONBOARDING_REPO: repo,
      SMART_TERMINAL_ONBOARDING_MACHINE: machine,
      SMART_TERMINAL_ONBOARDING_SMOKE_TOKEN: token,
    },
  });
  return result.status === 0;
}

const userData = path.join(root, 'ud');
const ok = run('first', userData) && run('second', userData) && run('skip', path.join(root, 'ud-skip'));
fs.rmSync(root, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
