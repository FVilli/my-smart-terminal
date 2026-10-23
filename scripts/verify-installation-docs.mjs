import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const guides = [
  'docs/20 - Windows installation guide.md',
  'docs/21 - Linux installation guide.md',
  'docs/22 - macOS installation guide.md',
];
const read = (file) => {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (error) { fail(`Cannot read ${file}: ${error.message}`); }
};
function fail(message) {
  console.error(`Installation docs verification failed: ${message}`);
  process.exit(1);
}

const readme = read('README.md');
const sectionStart = readme.indexOf('## Install Smart Terminal');
if (sectionStart < 0) fail('README.md is missing "## Install Smart Terminal".');
const afterStart = readme.slice(sectionStart + '## Install Smart Terminal'.length);
const nextHeading = afterStart.search(/^## .+$/m);
const installSection = nextHeading < 0 ? afterStart : afterStart.slice(0, nextHeading);
const expected = guides.map((file) => file.replaceAll(' ', '%20'));
const links = [...installSection.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
if (links.length !== 3 || expected.some((target) => !links.includes(target))) {
  fail(`README installation section must contain exactly links to ${expected.join(', ')}; found ${links.join(', ') || 'none'}.`);
}
if (/\b(?:curl|wget|Invoke-WebRequest|winget|apt\s+install|dpkg|brew\s+install)\b|Smart\.Terminal-|\.(?:deb|AppImage|dmg|exe)\b/i.test(installSection)) {
  fail('README installation section contains a download/install command or release artifact reference.');
}

const staleFiles = ['README.md', 'docs/12 - User manual.md', 'docs/14 - Post-install onboarding.md', ...guides];
const stalePatterns = [/My-Smart-Terminal\.AppImage/i, /~\/.config\/Smart Terminal/i, /%APPDATA%\/Smart Terminal/i];
for (const file of staleFiles) {
  const text = read(file);
  for (const pattern of stalePatterns) if (pattern.test(text)) fail(`${file} contains stale reference ${pattern}.`);
}

for (const file of guides) {
  const text = read(file);
  for (const concept of ['install', 'update', 'uninstall', 'data', 'troubleshooting', 'unsigned']) {
    if (!new RegExp(concept, 'i').test(text)) fail(`${file} is missing the concept "${concept}".`);
  }
}
const linuxGuide = read('docs/21 - Linux installation guide.md');
if (!/sudo apt remove -y my-smart-terminal/.test(linuxGuide)) {
  fail('docs/21 must use the actual .deb package name my-smart-terminal for removal.');
}

const requiredPaths = [
  ['Windows', /%APPDATA%\\my-smart-terminal/i],
  ['Linux', /~\/\.config\/my-smart-terminal/i],
  ['macOS', /~\/Library\/Application Support\/my-smart-terminal/i],
];
for (const [platform, pattern] of requiredPaths) {
  const file = guides.find((guide) => guide.includes(platform === 'macOS' ? 'macOS' : platform));
  if (!pattern.test(read(file))) fail(`${file} must document ${platform} user-data path ${pattern}.`);
}

const unsafe = [/\bxattr\s+-d(?:r)?\b/i, /\bspctl\s+--master-disable\b/i];
const allowedPipedInstall = /^curl\s+-fsSL\s+https:\/\/raw\.githubusercontent\.com\/FVilli\/my-smart-terminal\/v[0-9.]+\/(?:install|uninstall)\.sh\s*\|\s*sh(?:\s+-s\s+--\s+--(?:deb|appimage))?\s*$/;
for (const file of guides) {
  const text = read(file);
  for (const pattern of unsafe) if (pattern.test(text)) fail(`${file} contains unsafe command ${pattern}.`);
  for (const line of text.split(/\r?\n/)) {
    if (/\bcurl\b[^\n|]*\|\s*(?:bash|sh)\b/.test(line) && /https?:\/\//.test(line) && !allowedPipedInstall.test(line.trim())) {
      fail(`${file} contains a curl-to-shell command that is not the pinned Smart Terminal installer.`);
    }
    if (/\brm\s+-rf\b/.test(line) && !/rm\s+-rf\s+(?:"\$TMP"|'\$TMP'|\$TMP)(?:['"\s]|$)/.test(line)) {
      fail(`${file} contains potentially destructive rm -rf command: ${line.trim()}`);
    }
  }
}

let checkedBlocks = 0;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-installation-docs-'));
try {
  for (const file of guides.slice(1)) {
    const text = read(file);
    let index = 0;
    for (const match of text.matchAll(/^```bash\s*\r?\n([\s\S]*?)^```\s*$/gm)) {
      const script = path.join(temp, `block-${checkedBlocks}.sh`);
      fs.writeFileSync(script, match[1]);
      const result = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
      if (result.status !== 0) fail(`${file} bash block ${index + 1} has syntax errors: ${(result.stderr || result.stdout).trim()}`);
      checkedBlocks += 1;
      index += 1;
    }
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log(`Installation docs OK: ${guides.length} guides, ${links.length} README links, ${checkedBlocks} bash blocks syntax-checked.`);
