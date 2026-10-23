import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SMOKE_DATA_DIR, resetSmokeData } from './reset-smoke-data.mjs';

const outDir = path.resolve('dist', 'layout');
const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 700 },
];

if (!fs.existsSync('dist/apps/desktop/main.js') || !fs.existsSync('dist/apps/renderer/browser/index.html')) {
  const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
fs.mkdirSync(outDir, { recursive: true });

let failed = false;
for (const { width, height } of viewports) {
  const screenshot = path.join(outDir, `layout-${width}x${height}.png`);
  fs.rmSync(screenshot, { force: true });
  resetSmokeData();
  const env = {
    ...process.env,
    SMART_TERMINAL_DATA_REPO: SMOKE_DATA_DIR,
    SMART_TERMINAL_CAPTURE: screenshot,
    SMART_TERMINAL_WINDOW_WIDTH: String(width),
    SMART_TERMINAL_WINDOW_HEIGHT: String(height),
  };
  const run = spawnSync(process.execPath, ['scripts/run-electron.mjs', 'apps/desktop'], { env, encoding: 'utf8', timeout: 60000 });
  const line = (run.stdout ?? '').split('\n').find((l) => l.startsWith('SMART_TERMINAL_LAYOUT_RESULT'));
  const metrics = line ? JSON.parse(line.slice(line.indexOf('{'))) : null;
  const problems = [];
  if (run.status !== 0) problems.push(`exit ${run.status}`);
  if (!metrics) problems.push('metriche mancanti');
  else {
    if (Math.abs(metrics.ratio - 0.75) > 0.02) problems.push(`ratio ${metrics.ratio}`);
    if (metrics.overflow !== false) problems.push('overflow');
  }
  if (!fs.existsSync(screenshot) || fs.statSync(screenshot).size === 0) problems.push('screenshot missing');
  console.log(`${width}x${height}`, JSON.stringify(metrics), problems.length ? `FAIL: ${problems.join(', ')}` : 'OK', screenshot);
  if (problems.length) {
    failed = true;
    console.error(run.stderr);
  }
}
process.exit(failed ? 1 : 0);
