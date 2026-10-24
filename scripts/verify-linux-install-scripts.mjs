import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'linux') {
  console.log('Linux install scripts verification skipped: Linux-only harness.');
  process.exit(0);
}

const root = process.cwd();
const scripts = ['install.sh', 'uninstall.sh'];
function fail(message) { console.error(`Linux install scripts verification failed: ${message}`); process.exit(1); }
for (const script of scripts) {
  const text = fs.readFileSync(script, 'utf8');
  const syntax = spawnSync('sh', ['-n', script], { encoding: 'utf8' });
  if (syntax.status !== 0) fail(`${script} syntax: ${syntax.stderr}`);
  if (/\bcurl\b[^\n|]*\|\s*(?:sh|bash)\b|\brm\s+-rf\s+~|\bsudo\s+sh\b|\beval\b/.test(text)) fail(`${script} contains unsafe pattern`);
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-linux-install-'));
try {
  const bin = path.join(temp, 'fakebin'); fs.mkdirSync(bin);
  const log = path.join(temp, 'calls.log');
  const writeCommand = (name, body) => fs.writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  writeCommand('uname', 'case "$1" in -s) echo Linux;; -m) echo x86_64;; esac');
  writeCommand('id', 'echo 1000');
  writeCommand('dpkg', 'exit 0');
  writeCommand('sudo', `printf 'sudo:%s\\n' "$*" >> '${log}'\nexit 0`);
  writeCommand('apt-get', `printf 'apt:%s\\n' "$*" >> '${log}'`);
  writeCommand('dpkg-query', `if [ "\${FAKE_DPKG_INSTALLED:-0}" = 1 ]; then printf 'install ok installed\\n'; else exit 1; fi`);
  writeCommand('update-desktop-database', `printf 'desktop-cache\\n' >> '${log}'`);
  writeCommand('gtk-update-icon-cache', `printf 'icon-cache\\n' >> '${log}'`);
  const artifacts = {
    'Smart.Terminal-1.3.8-linux-amd64.deb': 'deb fixture',
    'Smart.Terminal-1.3.8-linux-x86_64.AppImage': 'app fixture',
    'icon.png': 'icon fixture',
  };
  const sums = Object.entries(artifacts).filter(([n]) => n !== 'icon.png').map(([name, value]) => `${crypto.createHash('sha256').update(value).digest('hex')}  ${name}`).join('\n');
  writeCommand('curl', `OUT= URL=\nwhile [ "$#" -gt 0 ]; do if [ "$1" = -o ]; then OUT=$2; shift 2; else URL=$1; shift; fi; done\nprintf 'curl:%s\\n' "$URL" >> '${log}'\ncase "$URL" in */SHA256SUMS) if [ "\${BAD_CHECKSUM:-0}" = 1 ]; then printf '%s\\n' '${sums.replace(/[a-f0-9]{64}/, '0'.repeat(64))}' > "$OUT"; else printf '%s\\n' '${sums}' > "$OUT"; fi;; */docs/assets/icon.png) printf 'icon fixture' > "$OUT";; *.deb) printf 'deb fixture' > "$OUT";; *AppImage) printf 'app fixture' > "$OUT";; *) exit 1;; esac`);
  const home = path.join(temp, 'home'); fs.mkdirSync(home);
  fs.mkdirSync(path.join(temp, 'etc')); fs.writeFileSync(path.join(temp, 'etc', 'debian_version'), 'test');
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: home, XDG_BIN_HOME: path.join(temp, 'xdg-bin'), XDG_DATA_HOME: path.join(temp, 'xdg-data'), FAKE_DPKG_INSTALLED: '0' };
  // Use a controlled Debian marker without reading or changing the host marker.
  const installer = fs.readFileSync('install.sh', 'utf8').replace('[ -f /etc/debian_version ]', '[ -f "${TEST_DEBIAN_MARKER:-/etc/debian_version}" ]');
  env.TEST_DEBIAN_MARKER = path.join(temp, 'etc', 'debian_version');
  const deb = spawnSync('sh', ['-s'], { cwd: root, env, input: Buffer.from(installer), encoding: 'utf8' });
  const debCalls = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean);
  const sudoCalls = debCalls.filter((line) => line.startsWith('sudo:'));
  if (deb.status !== 0 || sudoCalls.length !== 1 || !/^sudo:apt-get install -y \/tmp\/[^/]+\/Smart\.Terminal-1\.3\.8-linux-amd64\.deb$/.test(sudoCalls[0]) || debCalls.some((line) => line.startsWith('apt:'))) fail(`Deb install failed or did not use exactly sudo apt-get install -y: ${deb.stderr}${deb.stdout}; calls=${debCalls.join('\n')}`);
  fs.writeFileSync(log, '');
  const app = spawnSync('sh', ['-s', '--', '--appimage'], { cwd: root, env, input: Buffer.from(installer), encoding: 'utf8' });
  if (app.status !== 0) fail(`AppImage install failed (${app.status}): ${app.stderr}${app.stdout}`);
  if (fs.readFileSync(log, 'utf8').split('\n').some((line) => line.startsWith('sudo:'))) fail('AppImage install invoked sudo.');
  const desktop = fs.readFileSync(path.join(env.XDG_DATA_HOME, 'applications/smart-terminal.desktop'), 'utf8');
  if (!desktop.includes(`Exec="${env.XDG_BIN_HOME}/smart-terminal"`) || !desktop.includes('Categories=Development;') || !desktop.includes('StartupWMClass=smart-terminal') || fs.readFileSync(path.join(env.XDG_BIN_HOME, 'smart-terminal'), 'utf8') !== 'app fixture') fail('AppImage contents or menu entry incorrect.');
  const desktopFile = path.join(env.XDG_DATA_HOME, 'applications/smart-terminal.desktop');
  const validate = spawnSync('desktop-file-validate', [desktopFile], { encoding: 'utf8' });
  if (validate.error?.code !== 'ENOENT' && validate.status !== 0) fail(`desktop-file-validate failed: ${validate.stderr || validate.stdout}`);
  const data = path.join(home, '.config/my-smart-terminal'); fs.mkdirSync(path.join(data, 'sessions'), { recursive: true }); fs.writeFileSync(path.join(data, 'sentinel'), 'keep'); fs.writeFileSync(path.join(data, 'sessions', 'sentinel'), 'keep');
  const externalRepo = path.join(temp, 'external-repository'); fs.mkdirSync(externalRepo); fs.writeFileSync(path.join(externalRepo, 'sentinel'), 'keep');
  const uninstall = spawnSync('sh', [path.join(root, 'uninstall.sh')], { cwd: root, env: { ...env, FAKE_DPKG_INSTALLED: '1' }, encoding: 'utf8' });
  if (uninstall.status !== 0 || !fs.existsSync(path.join(data, 'sentinel')) || !fs.existsSync(path.join(data, 'sessions', 'sentinel')) || !fs.existsSync(path.join(externalRepo, 'sentinel'))) fail(`Uninstall failed or removed user data/repository: ${uninstall.stderr}`);
  fs.writeFileSync(log, '');
  const mismatch = spawnSync('sh', ['-s', '--', '--deb'], { cwd: root, env: { ...env, BAD_CHECKSUM: '1' }, input: Buffer.from(installer), encoding: 'utf8' });
  const mismatchCalls = fs.readFileSync(log, 'utf8');
  if (mismatch.status === 0 || mismatchCalls.includes('apt:') || mismatchCalls.includes('sudo:')) fail('Checksum mismatch did not fail before apt-get install.');
  fs.writeFileSync(log, '');
  const piped = spawnSync('sh', ['-c', 'cat install.sh | sh -s -- --appimage'], { cwd: root, env, encoding: 'utf8' });
  if (piped.status !== 0) fail(`Piped AppImage install failed (${piped.status}): ${piped.stderr}${piped.stdout}`);
  console.log('Linux install scripts OK: shell syntax, checksum-backed deb and AppImage flows, menu entry, uninstall preservation.');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
