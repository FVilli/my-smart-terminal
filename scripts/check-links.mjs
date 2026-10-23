import fs from 'node:fs';
import path from 'node:path';

const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!['.git', 'node_modules', 'dist', 'release', '.smoke-data'].includes(entry.name)) walk(full);
    } else if (entry.name.endsWith('.md')) files.push(full);
  }
}
walk('.');
const broken = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    let target = match[1].split('#')[0];
    if (!target || /^https?:|^mailto:/.test(target)) continue;
    try { target = decodeURIComponent(target); } catch { /* leave as-is */ }
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) broken.push(`${file} -> ${match[1]}`);
  }
}
if (broken.length > 0) {
  console.error('Broken Markdown links:\n' + broken.join('\n'));
  process.exit(1);
}
console.log(`Markdown links OK (${files.length} files)`);
