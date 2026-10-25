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

  it('keeps arbitrary design utilities out of app templates', () => {
    // Structural exceptions present today: dialog constraints, title/header layout,
    // fixed menu width, and min-width form/help constraints.
    const structural = new Set([
      'w-[min(520px,92vw)]', 'h-[90vh]', 'w-[220px]', 'w-[45%]',
    ]);
    const utility = /(?:^|[\s"'])((?:text|gap|py|px|p|rounded|opacity|leading|tracking|shadow|h|w)-\[[^\]]+\])/g;
    const offenders: string[] = [];
    for (const { rel, text } of files) {
      for (const match of text.matchAll(utility)) {
        const token = match[1];
        if (!token) continue;
        if (structural.has(token)) continue;
        if (/^[hw]-\[(?:min\(|max\(|grid|auto|[4-9]\d|\d{3,})/.test(token)) continue;
        offenders.push(`${rel}:${text.slice(0, match.index).split('\n').length}:${token}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
