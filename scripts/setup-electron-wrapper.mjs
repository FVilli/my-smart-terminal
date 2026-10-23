import fs from 'node:fs';
import path from 'node:path';

const binDir = path.resolve('node_modules', '.bin');
const shimPath = path.join(binDir, 'electron');
const wrapper = path.resolve('scripts', 'run-electron.mjs');

if (!fs.existsSync(binDir)) {
  console.error('[setup-electron-wrapper] node_modules/.bin not found: run npm install');
  process.exit(1);
}

const script = `#!/bin/sh
# Shim generato da scripts/setup-electron-wrapper.mjs.
# Routes every "electron" invocation to the virtual Xvfb display, never the user desktop.
exec node "${wrapper}" "$@"
`;

try {
  fs.rmSync(shimPath, { force: true });
  fs.writeFileSync(shimPath, script, { mode: 0o755 });
  console.log(`[setup-electron-wrapper] installato ${shimPath}`);
} catch (error) {
  console.error('[setup-electron-wrapper] unable to install the shim', error);
  process.exit(1);
}
