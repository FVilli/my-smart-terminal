import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const release = path.resolve('release');
const deb = process.argv[2] ?? fs.readdirSync(release).find((name) => name.endsWith('.deb'));
if (!deb) {
  console.error('[verify-linux-package] no .deb in release/');
  process.exit(1);
}
const file = path.isAbsolute(deb) ? deb : path.join(release, deb);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-package-'));
const problems = [];
try {
  const contents = execFileSync('dpkg-deb', ['-c', file], { encoding: 'utf8' });
  for (const expected of [
    './usr/share/applications/smart-terminal.desktop',
    './usr/share/icons/hicolor/512x512/apps/smart-terminal.png',
    './opt/Smart Terminal/smart-terminal',
  ]) {
    if (!contents.includes(expected)) problems.push(`missing ${expected}`);
  }
  execFileSync('dpkg-deb', ['-x', file, root]);
  const desktop = fs.readFileSync(path.join(root, 'usr/share/applications/smart-terminal.desktop'), 'utf8');
  for (const expected of ['Name=Smart Terminal', 'Type=Application', 'Terminal=false', 'Categories=Development;', 'StartupWMClass=smart-terminal']) {
    if (!desktop.includes(expected)) problems.push(`desktop missing ${expected}`);
  }
  const exec = /^Exec="?([^"\n]+)"?/m.exec(desktop)?.[1];
  const binary = exec ? path.join(root, exec.replace(/^\/+/, '')) : '';
  if (!binary || !fs.existsSync(binary) || !(fs.statSync(binary).mode & 0o111)) problems.push('desktop Exec is not executable in package');
  const info = execFileSync('dpkg-deb', ['-f', file, 'Package', 'Version'], { encoding: 'utf8' }).trim();
  if (!info.includes('smart-terminal')) problems.push('package name missing');
  try {
    execFileSync('desktop-file-validate', [path.join(root, 'usr/share/applications/smart-terminal.desktop')], { stdio: 'pipe' });
  } catch (error) {
    if (error?.code !== 'ENOENT') problems.push('desktop-file-validate failed');
  }
  console.log('SMART_TERMINAL_LINUX_PACKAGE_RESULT', JSON.stringify({ deb: path.basename(file), info, desktopEntry: exec, ok: problems.length === 0, problems }));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
process.exit(problems.length === 0 ? 0 : 1);
