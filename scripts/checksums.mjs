import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release');
if (!fs.existsSync(releaseDir)) {
  console.error('[checksums] release/ non esiste: esegui prima il packaging');
  process.exit(1);
}
const files = fs
  .readdirSync(releaseDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && !['SHA256SUMS', 'builder-debug.yml', 'builder-effective-config.yaml'].includes(entry.name) && !entry.name.startsWith('latest-'))
  .map((entry) => entry.name)
  .sort();
const lines = files.map((name) => {
  const hash = createHash('sha256').update(fs.readFileSync(path.join(releaseDir, name))).digest('hex');
  return `${hash}  ${name}`;
});
const out = path.join(releaseDir, 'SHA256SUMS');
fs.writeFileSync(out, `${lines.join('\n')}\n`, 'utf8');
console.log(lines.join('\n'));
