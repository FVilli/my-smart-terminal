import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-terminal-e2e-'));
const children = new Set();
const timeout = 45000;
const marker = `e2e-cross-${Date.now()}-${Math.random().toString(16).slice(2)}`;
function launch(instance, mode, env) {
  const child = spawn(process.execPath, ['scripts/run-electron.mjs', 'apps/desktop'], { cwd: process.cwd(), env: { ...process.env, ...env, SMART_TERMINAL_E2E_MODE: mode, SMART_TERMINAL_E2E_INSTANCE: instance, ELECTRON_ENABLE_LOGGING: '0' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  children.add(child);
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, read: (prefix) => output.split(/\r?\n/).filter((line) => line.includes(prefix)).map((line) => { try { return JSON.parse(line.slice(line.indexOf(prefix) + prefix.length).trim()); } catch { return null; } }).filter(Boolean) };
}
async function waitFor(test, label) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const result = test(); if (result) return result; await delay(150); }
  throw new Error(`timeout: ${label}`);
}
function killGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch {
    try { child.kill(signal); return true; } catch { return false; }
  }
}
async function stop(item, signal = 'SIGTERM') {
  if (item && item.child.exitCode === null) {
    killGroup(item.child, signal);
    await Promise.race([new Promise((resolve) => item.child.once('exit', resolve)), delay(4000)]);
  }
}
try {
  const sameRepo = path.join(root, 'same-repo');
  const sameEnv = { SMART_TERMINAL_USER_DATA: path.join(root, 'same-user'), SMART_TERMINAL_DATA_REPO: sameRepo, SMART_TERMINAL_MACHINE: 'same' };
  const a = launch('A', 'same-machine', sameEnv); const b = launch('B', 'same-machine', sameEnv);
  const [ar, br] = await Promise.all([waitFor(() => a.read('SMART_TERMINAL_E2E_READY ').at(-1), 'A ready'), waitFor(() => b.read('SMART_TERMINAL_E2E_READY ').at(-1), 'B ready')]);
  if (ar.sessionId === br.sessionId || ar.isPrimary === br.isPrimary) throw new Error('same-machine IDs/primary invariant failed');
  for (const r of [ar, br]) if (!fs.existsSync(path.join(sameRepo, r.sessionDirectory, 'session.md'))) throw new Error('missing session markdown');
  const primary = ar.isPrimary ? a : b; const secondary = ar.isPrimary ? b : a;
  await stop(primary, 'SIGKILL');
  const takeover = await waitFor(() => secondary.read('SMART_TERMINAL_E2E_ROLE ').find((r) => r.isPrimary), 'primary takeover');
  console.log(`takeover: ${JSON.stringify(takeover)}`);

  const bare = path.join(root, 'remote.git');
  const { execFileSync } = await import('node:child_process');
  execFileSync('git', ['init', '--bare', bare]);
  const alpha = launch('A', 'cross-machine', { SMART_TERMINAL_USER_DATA: path.join(root, 'alpha-user'), SMART_TERMINAL_DATA_REPO: path.join(root, 'alpha-repo'), SMART_TERMINAL_MACHINE: 'alpha', SMART_TERMINAL_GIT_REMOTE: bare, SMART_TERMINAL_SYNC_FETCH_INTERVAL_MS: '300', SMART_TERMINAL_SYNC_DEBOUNCE_MS: '300', SMART_TERMINAL_SYNC_MAX_WAIT_MS: '1000', SMART_TERMINAL_E2E_MARKER: marker });
  const beta = launch('B', 'cross-machine', { SMART_TERMINAL_USER_DATA: path.join(root, 'beta-user'), SMART_TERMINAL_DATA_REPO: path.join(root, 'beta-repo'), SMART_TERMINAL_MACHINE: 'beta', SMART_TERMINAL_GIT_REMOTE: bare, SMART_TERMINAL_SYNC_FETCH_INTERVAL_MS: '300', SMART_TERMINAL_SYNC_DEBOUNCE_MS: '300', SMART_TERMINAL_SYNC_MAX_WAIT_MS: '1000', SMART_TERMINAL_E2E_MARKER: marker });
  await Promise.all([waitFor(() => alpha.read('SMART_TERMINAL_E2E_READY ').at(-1), 'alpha ready'), waitFor(() => beta.read('SMART_TERMINAL_E2E_READY ').at(-1), 'beta ready')]);
  await waitFor(() => beta.read('SMART_TERMINAL_E2E_SEARCH ').find((r) => r.found), 'cross-machine marker');
  console.log('cross-machine: marker found by B');
} catch (error) { console.error(`E2E FAILED: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; }
finally { for (const child of children) if (child.exitCode === null) killGroup(child, 'SIGKILL'); await delay(500); fs.rmSync(root, { recursive: true, force: true }); }
