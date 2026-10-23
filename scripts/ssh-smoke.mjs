import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resetSmokeData, SMOKE_DATA_DIR } from './reset-smoke-data.mjs';

// Prepara config SSH (con Include e wildcard), fake ssh e una chiave decoy che non deve mai essere copiata.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-ssh-smoke-'));
const sshDir = path.join(root, '.ssh');
fs.mkdirSync(path.join(sshDir, 'conf.d'), { recursive: true });
const decoyMarker = `DECOY_PRIVATE_KEY_${Date.now()}`;
fs.writeFileSync(path.join(sshDir, 'id_smoke'), `-----BEGIN OPENSSH PRIVATE KEY-----\n${decoyMarker}\n-----END OPENSSH PRIVATE KEY-----\n`, { mode: 0o600 });
fs.writeFileSync(
  path.join(sshDir, 'config'),
  ['# smoke config', 'Include conf.d/*.conf', 'Host smoke-host smoke-fail', '  HostName 127.0.0.1', '  IdentityFile ' + path.join(sshDir, 'id_smoke'), 'Host *', '  ForwardAgent no', 'Match host nothing', '  User nobody', ''].join('\n'),
);
fs.writeFileSync(path.join(sshDir, 'conf.d', 'extra.conf'), 'Host smoke-included\nHost *.wild\n');

const log = path.join(root, 'fake-ssh.log');
const fakeSsh = path.join(root, 'fake-ssh');
fs.writeFileSync(
  fakeSsh,
  [
    '#!/bin/sh',
    'echo "ARGS=$*" >> "$SMART_TERMINAL_SSH_SMOKE_LOG"',
    'echo "AUTH=${SSH_AUTH_SOCK:+present}" >> "$SMART_TERMINAL_SSH_SMOKE_LOG"',
    'if [ "$1" = smoke-fail ]; then echo SSH_FAKE_FAIL; exit 255; fi',
    'echo "SSH_FAKE_OK $1 auth=${SSH_AUTH_SOCK:+present}"',
    'exec sleep 30',
    '',
  ].join('\n'),
  { mode: 0o755 },
);

resetSmokeData();
const result = spawnSync('node', ['scripts/run-electron.mjs', 'apps/desktop'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    SMART_TERMINAL_DATA_REPO: SMOKE_DATA_DIR,
    SMART_TERMINAL_SSH_SMOKE: '1',
    SMART_TERMINAL_SSH_CONFIG: path.join(sshDir, 'config'),
    SMART_TERMINAL_SSH_BINARY: fakeSsh,
    SMART_TERMINAL_SSH_SMOKE_LOG: log,
    SMART_TERMINAL_SSH_SMOKE_DECOY_MARKER: decoyMarker,
    SSH_AUTH_SOCK: '/tmp/smart-terminal-smoke-agent.sock',
  },
});
fs.rmSync(root, { recursive: true, force: true });
process.exit(result.status ?? 1);
