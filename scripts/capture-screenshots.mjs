import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-screens-'));
const outDir = path.resolve('docs/assets/screenshots');
const repo = path.join(root, 'data');
const userData = path.join(root, 'user-data');
const onboardingUserData = path.join(root, 'onboarding-user-data');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(repo, 'sessions'), { recursive: true });
fs.mkdirSync(userData, { recursive: true });
fs.mkdirSync(onboardingUserData, { recursive: true });

const iso = '2026-10-23T10:05:00+02:00';
const created = '2026-10-23T10:00:00+02:00';
const dirName = '2026-10-23_10.00_S1_local';

function session(machine, command) {
  const dir = path.join(repo, 'sessions', machine, dirName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'session.md'), [
    '---',
    'schema_version: 1',
    'session_id: S1',
    `machine: ${machine}`,
    'created_at: "' + created + '"',
    'window_id: screenshot-window',
    'kind: local',
    'cwd_initial: /home/dev/project',
    'started_at: "' + created + '"',
    'ended_at: "' + iso + '"',
    '---',
    '',
    '# S1',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'history.md'), [
    '---',
    'schema_version: 1',
    'session_id: S1',
    `machine: ${machine}`,
    'created_at: "' + created + '"',
    '---',
    '',
    '# History S1',
    '',
    '## ' + iso + ' · e1',
    '',
    '- source: assisted',
    '- agent: editor',
    '- cwd: /home/dev/project',
    '',
    '```text',
    command,
    '```',
    '',
  ].join('\n'));
  const clipboardText = 'git status';
  fs.writeFileSync(path.join(dir, 'clipboard.md'), [
    '---',
    'schema_version: 1',
    'session_id: S1',
    `machine: ${machine}`,
    'created_at: "' + created + '"',
    '---',
    '',
    '# Clipboard S1',
    '',
    '## ' + iso + ' · c1',
    '',
    '- type: text',
    '- source: system',
    '- hash: ' + createHash('sha256').update(clipboardText).digest('hex'),
    '',
    '```text',
    clipboardText,
    '```',
    '',
  ].join('\n'));
}

session('studio', 'npm run build');
session('remote-box', 'git pull --rebase');

const aiConfig = path.join(userData, 'config');
fs.mkdirSync(aiConfig, { recursive: true });
fs.writeFileSync(path.join(aiConfig, 'config.md'), [
  '---',
  'schema_version: 1',
  'machine_name: "studio"',
  'data_repo_path: "' + repo.replaceAll('\\', '/') + '"',
  'ai_provider: "openai-compatible"',
  'ai_base_url: "https://ai.example.test/v1"',
  'ai_model: "test-model"',
  'stt_provider: "none"',
  '---',
  '',
  '# Configuration',
  '',
].join('\n'));

const sshConfig = path.join(root, 'ssh-config');
fs.writeFileSync(sshConfig, 'Host prod-box\n  HostName prod.example.test\nHost staging\n  HostName staging.example.test\n');

const viewport = { width: 1440, height: 900 };
const scenarios = [
  { name: '01-onboarding.png', scenario: 'onboarding', userData: onboardingUserData, extra: {} },
  { name: '02-terminal-tabs.png', scenario: 'tabs', extra: {} },
  { name: '03-ssh-menu.png', scenario: 'ssh-menu', extra: { SMART_TERMINAL_SSH_CONFIG: sshConfig } },
  { name: '04-ai-review.png', scenario: 'ai-review', userData, extra: { SMART_TERMINAL_AI_TEST_MODE: '1' } },
  { name: '05-history.png', scenario: 'history', extra: {} },
  { name: '06-clipboard.png', scenario: 'clipboard', extra: {} },
  { name: '07-onboarding-ai.png', scenario: 'onboarding-ai', userData: onboardingUserData, extra: {} },
  { name: '08-onboarding-stt.png', scenario: 'onboarding-stt', userData: onboardingUserData, extra: {} },
  { name: '09-ai-actions.png', scenario: 'ai-actions', userData, extra: { SMART_TERMINAL_AI_TEST_MODE: '1' } },
  { name: '10-ai-settings.png', scenario: 'ai-settings', userData, extra: {} },
];

const baseEnv = { ...process.env };
for (const key of Object.keys(baseEnv)) {
  if (key.startsWith('SMART_TERMINAL_') && key !== 'SMART_TERMINAL_XVFB_BIN') delete baseEnv[key];
}

let failed = false;
for (const item of scenarios) {
  const output = path.join(outDir, item.name);
  fs.rmSync(output, { force: true });
  const env = {
    ...baseEnv,
    SMART_TERMINAL_USER_DATA: item.userData ?? userData,
    SMART_TERMINAL_DATA_REPO: repo,
    SMART_TERMINAL_CAPTURE: output,
    SMART_TERMINAL_CAPTURE_SCENARIO: item.scenario,
    SMART_TERMINAL_WINDOW_WIDTH: String(viewport.width),
    SMART_TERMINAL_WINDOW_HEIGHT: String(viewport.height),
    ...item.extra,
  };
  if (item.scenario.startsWith('onboarding')) delete env.SMART_TERMINAL_DATA_REPO;
  const run = spawnSync(process.execPath, ['scripts/run-electron.mjs', 'apps/desktop'], {
    env,
    encoding: 'utf8',
    timeout: 120000,
  });
  const exists = fs.existsSync(output) && fs.statSync(output).size > 0;
  let dimensions = null;
  if (exists) {
    const png = fs.readFileSync(output);
    dimensions = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  }
  const ok = run.status === 0 && exists && dimensions?.width === viewport.width && dimensions?.height >= 850 && dimensions?.height <= viewport.height;
  console.log(`${item.name}: ${ok ? 'OK' : 'FAIL'}`, dimensions ?? '', run.status);
  if (!ok) {
    failed = true;
    console.error(run.stdout?.slice(-2000));
    console.error(run.stderr?.slice(-2000));
  }
}

fs.rmSync(root, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
