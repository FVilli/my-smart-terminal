import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve('apps/renderer/src');
const allowHex = new Set(['app/appearance/terminal-theme.ts']);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [target] : [];
  });
}

describe('renderer style guard', () => {
  const files = sourceFiles(root).map((file) => ({ file, rel: path.relative(root, file).split(path.sep).join('/'), text: fs.readFileSync(file, 'utf8') }));

  it('keeps design styles out of components', () => {
    const offenders = files.filter(({ text }) => /\bstyles:\s*[\[`]/.test(text) || /\bstyle="/.test(text) || /!important/.test(text)).map(({ rel }) => rel);
    expect(offenders).toEqual([]);
  });

  it('keeps colour literals in the theme source only', () => {
    const offenders = files.filter(({ rel, text }) => !allowHex.has(rel) && /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(text)).map(({ rel }) => rel);
    expect(offenders).toEqual([]);
  });
});
