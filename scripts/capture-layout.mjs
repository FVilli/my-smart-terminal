import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SMOKE_DATA_DIR, resetSmokeData } from './reset-smoke-data.mjs';

const outDir = path.resolve('dist', 'layout');
const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 700 },
];
const themes = [
  { name: 'dark', env: {}, metrics: { terminalBg: 'rgb(23, 30, 37)', sidebarBg: 'rgb(23, 30, 37)', activeTabBg: 'rgb(56, 74, 93)', inputBg: ['rgb(33, 43, 56)', 'rgb(34, 46, 60)'] } },
  { name: 'light', env: { SMART_TERMINAL_THEME: 'light' }, metrics: { terminalBg: 'rgb(255, 255, 255)', sidebarBg: 'rgb(244, 246, 248)', activeTabBg: 'rgb(213, 224, 232)', inputBg: ['rgb(255, 255, 255)'] } },
];

if (!fs.existsSync('dist/apps/desktop/main.js') || !fs.existsSync('dist/apps/renderer/browser/index.html')) {
  const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
fs.mkdirSync(outDir, { recursive: true });

let failed = false;
for (const { width, height } of viewports) for (const theme of themes) {
  const screenshot = path.join(outDir, theme.name === 'dark' ? `layout-${width}x${height}.png` : `layout-${width}x${height}-${theme.name}.png`);
  fs.rmSync(screenshot, { force: true });
  resetSmokeData();
  const env = {
    ...process.env,
    SMART_TERMINAL_DATA_REPO: SMOKE_DATA_DIR,
    SMART_TERMINAL_CAPTURE: screenshot,
    SMART_TERMINAL_WINDOW_WIDTH: String(width),
    SMART_TERMINAL_WINDOW_HEIGHT: String(height),
    ...theme.env,
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
    if (Math.abs(metrics.headerHeight - 35) > 2) problems.push(`header ${metrics.headerHeight}`);
    if (Math.abs(metrics.tabBarHeight - 38) > 2) problems.push(`tabs ${metrics.tabBarHeight}`);
    if (metrics.inputHeight < 110 || metrics.inputHeight > 160) problems.push(`input ${metrics.inputHeight}`);
    if (Math.abs(metrics.footerHeight - 28) > 2) problems.push(`footer ${metrics.footerHeight}`);
    if (metrics.theme !== theme.name) problems.push(`theme ${metrics.theme}`);
    if (metrics.activeTabBg !== theme.metrics.activeTabBg) problems.push(`active tab ${metrics.activeTabBg}`);
    if (metrics.sidebarBg !== theme.metrics.sidebarBg) problems.push(`sidebar ${metrics.sidebarBg}`);
    if (metrics.terminalBg !== theme.metrics.terminalBg) problems.push(`terminal ${metrics.terminalBg}`);
    if (!theme.metrics.inputBg.includes(metrics.inputBg)) problems.push(`input bg ${metrics.inputBg}`);
  }
  if (!fs.existsSync(screenshot) || fs.statSync(screenshot).size === 0) problems.push('screenshot missing');
  console.log(`${width}x${height} ${theme.name}`, JSON.stringify(metrics), problems.length ? `FAIL: ${problems.join(', ')}` : 'OK', screenshot);
  if (problems.length) {
    failed = true;
    console.error(run.stderr);
  }
}
process.exit(failed ? 1 : 0);
