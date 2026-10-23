import fs from 'node:fs';
import path from 'node:path';

/** Temporary data directory used by smoke tests (SMART_TERMINAL_DATA_REPO), recreated empty on every run. */
export const SMOKE_DATA_DIR = path.resolve('.smoke-data');

export function resetSmokeData() {
  fs.rmSync(SMOKE_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(SMOKE_DATA_DIR, { recursive: true });
}

if (process.argv[1]?.endsWith('reset-smoke-data.mjs')) {
  resetSmokeData();
}
