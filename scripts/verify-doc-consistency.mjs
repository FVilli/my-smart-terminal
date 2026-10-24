import fs from 'node:fs';

const currentDocs = [
  'README.md',
  'docs/08 - UX and interactions.md',
  'docs/11 - IPC contracts and runtime verification.md',
  'docs/12 - User manual.md',
  'docs/13 - Security checklist.md',
  'docs/14 - Post-install onboarding.md',
  'docs/17 - STT setup guide.md',
  'docs/19 - AI provider setup guide.md',
  'docs/20 - Windows installation guide.md',
  'docs/21 - Linux installation guide.md',
  'docs/22 - macOS installation guide.md',
];
const failures = [];
function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (error) { failures.push(`${file}: cannot read file (${error.message})`); return ''; }
}
const pkg = JSON.parse(read('package.json'));
const version = pkg.version;
const docs = new Map(currentDocs.map((file) => [file, read(file)]));
function requireText(file, value, description) {
  if (!docs.get(file)?.includes(value)) failures.push(`${file}: missing ${description}: ${value}`);
}

if (!version) failures.push('package.json: missing version');
if (version && !docs.get('README.md')?.includes(`v${version}`)) failures.push(`README.md: current status must contain v${version}`);

const stalePatterns = [
  /My-Smart-Terminal\.AppImage/i,
  /~\/.config\/Smart Terminal/i,
  /%APPDATA%\/Smart Terminal/i,
  /path\/to\/Smart\.Terminal/i,
  /(?:https?:\/\/[^\s)]*(?:\/v1\.[12](?:\.\d+)?\/(?:install|uninstall)\.sh)|Smart\.Terminal-1\.[12](?:\.|\/|-))/i,
];
for (const [file, text] of docs) {
  for (const pattern of stalePatterns) if (pattern.test(text)) failures.push(`${file}: stale reference matches ${pattern}`);
}

const linux = docs.get('docs/21 - Linux installation guide.md') ?? '';
for (const line of linux.split(/\r?\n/)) {
  if (/\/install\.sh/.test(line) && !line.includes(`/v${version}/install.sh`)) failures.push(`docs/21 - Linux installation guide.md: install.sh URL must use pinned tag v${version}: ${line.trim()}`);
  if (/\/uninstall\.sh/.test(line) && !line.includes('/main/uninstall.sh')) failures.push(`docs/21 - Linux installation guide.md: uninstall.sh URL must use /main/uninstall.sh: ${line.trim()}`);
}
if (!/version-independent|not pinned to an application release|uninstaller.*main/i.test(linux)) failures.push('docs/21 - Linux installation guide.md: uninstall policy must describe main/version-independent behavior');

const contracts = ['window:control', 'window:maximized', 'setup:test-ai', 'sttBaseUrl', 'sttResponseFormat', 'sttLanguage'];
for (const file of ['docs/11 - IPC contracts and runtime verification.md', 'docs/13 - Security checklist.md']) {
  for (const contract of contracts) requireText(file, contract, `current contract ${contract}`);
}
const ipc = docs.get('docs/11 - IPC contracts and runtime verification.md') ?? '';
for (const word of [' che ', 'della', 'è ', 'non ']) {
  if (new RegExp(`\\b${word.trim()}\\b`, 'i').test(ipc)) failures.push(`docs/11 - IPC contracts and runtime verification.md: likely Italian text found (${word.trim()})`);
}

if (failures.length) {
  console.error(`Documentation consistency failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation consistency OK: ${currentDocs.length} current documents, version v${version}, contracts and install policy verified.`);
}
