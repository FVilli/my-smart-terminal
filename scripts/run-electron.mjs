import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('usage: node scripts/run-electron.mjs <app-path> [electron args...]');
  process.exit(2);
}

function findXvfb() {
  const candidates = [
    process.env['SMART_TERMINAL_XVFB_BIN'],
    '/usr/bin/Xvfb',
    '/usr/local/bin/Xvfb',
    path.join(os.homedir(), '.local/xvfb/usr/bin/Xvfb'),
  ].filter((candidate) => typeof candidate === 'string' && candidate.length > 0);
  return candidates.find((candidate) => {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function waitForSocket(socketPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(socketPath)) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  return fs.existsSync(socketPath);
}

/**
 * Su Linux avvia gli smoke su un display Xvfb dedicato (:99) per non usare il desktop
 * dell'utente. Disattivabile con SMART_TERMINAL_NO_XVFB=1.
 */
let display = process.env['DISPLAY'];
if (process.platform === 'linux' && process.env['SMART_TERMINAL_NO_XVFB'] !== '1') {
  const xvfb = findXvfb();
  if (xvfb !== undefined) {
    const virtualDisplay = process.env['SMART_TERMINAL_XVFB_DISPLAY'] ?? ':99';
    const socketPath = `/tmp/.X11-unix/X${virtualDisplay.replace(/^:/, '')}`;
    if (!fs.existsSync(socketPath)) {
      const server = spawn(xvfb, [virtualDisplay, '-screen', '0', '1600x1000x24', '-nolisten', 'tcp'], {
        detached: true,
        stdio: 'ignore',
      });
      server.unref();
      if (!waitForSocket(socketPath, 5000)) {
        console.error(`[run-electron] impossibile avviare Xvfb su ${virtualDisplay}`);
        process.exit(1);
      }
    }
    display = virtualDisplay;
    console.log(`[run-electron] display virtuale ${virtualDisplay}`);
  } else {
    console.warn('[run-electron] Xvfb non trovato: uso il display corrente');
  }
}

const childEnv = { ...process.env, ...(display !== undefined ? { DISPLAY: display } : {}) };
if (process.platform === 'linux') {
  // Se WAYLAND_DISPLAY resta impostato, Electron ignora DISPLAY e compare sul desktop Wayland dell'utente.
  delete childEnv['WAYLAND_DISPLAY'];
  childEnv['ELECTRON_OZONE_PLATFORM_HINT'] = 'x11';
  childEnv['GDK_BACKEND'] = 'x11';
}
const electronArgs = process.platform === 'linux' ? ['--ozone-platform=x11', ...args] : args;

const child = spawn(electronBinary, electronArgs, {
  stdio: 'inherit',
  env: childEnv,
});

child.on('error', (error) => {
  console.error('[run-electron] avvio Electron fallito', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
