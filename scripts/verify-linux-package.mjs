import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const release = path.resolve('release');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;
const releaseFiles = fs.readdirSync(release);
const debArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const preferredDeb = `Smart.Terminal-${version}-linux-amd64.deb`;
const deb = debArg ?? (releaseFiles.includes(preferredDeb) ? preferredDeb : releaseFiles.find((name) => name.endsWith('.deb')));
const debOnly = process.argv.includes('--deb-only');
const appImage = releaseFiles.find((name) => name === `Smart.Terminal-${version}-linux-x86_64.AppImage`);
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
  const packageName = execFileSync('dpkg-deb', ['-f', file, 'Package'], { encoding: 'utf8' }).trim();
  const packageVersion = execFileSync('dpkg-deb', ['-f', file, 'Version'], { encoding: 'utf8' }).trim();
  const architecture = execFileSync('dpkg-deb', ['-f', file, 'Architecture'], { encoding: 'utf8' }).trim();
  const info = `${packageName} ${packageVersion} ${architecture}`;
  if (packageName !== 'my-smart-terminal') problems.push(`unexpected package name: ${packageName}`);
  if (packageVersion !== version) problems.push(`unexpected package version: ${packageVersion} (expected ${version})`);
  if (architecture !== 'amd64') problems.push(`unexpected package architecture: ${architecture}`);
  if (!debOnly && !appImage) problems.push('no matching .AppImage in release/');
  else if (!debOnly && appImage) {
    const appPath = path.join(release, appImage);
    try {
      const appRoot = path.join(root, 'appimage'); fs.mkdirSync(appRoot);
      execFileSync(appPath, ['--appimage-extract'], { cwd: appRoot, stdio: 'pipe' });
      const extracted = path.join(appRoot, 'squashfs-root');
      const appDesktopPath = path.join(extracted, 'smart-terminal.desktop');
      const appIconPath = path.join(extracted, 'smart-terminal.png');
      if (!fs.existsSync(appDesktopPath)) problems.push('AppImage missing smart-terminal.desktop');
      if (!fs.existsSync(appIconPath)) problems.push('AppImage missing smart-terminal.png');
      else {
        if (fs.statSync(appIconPath).size !== fs.statSync('apps/desktop/build/icon-linux.png').size || !fs.readFileSync(appIconPath).equals(fs.readFileSync('apps/desktop/build/icon-linux.png'))) problems.push('AppImage icon does not match source icon bytes');
        const iconBytes = fs.readFileSync(appIconPath);
        if (iconBytes.length < 24 || iconBytes.toString('ascii', 1, 4) !== 'PNG' || iconBytes.readUInt32BE(16) !== 512 || iconBytes.readUInt32BE(20) !== 512) problems.push('AppImage icon is not 512x512 PNG');
      }
      if (fs.existsSync(appDesktopPath) && !fs.readFileSync(appDesktopPath, 'utf8').split(/\r?\n/).includes(`X-AppImage-Version=${version}`)) problems.push('AppImage desktop version does not match package version');
    } catch (error) { problems.push(`AppImage extraction/verification failed: ${error.message}`); }
  }
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
