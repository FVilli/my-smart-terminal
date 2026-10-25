import { describe, expect, it } from 'vitest';
import { formatConsoleText } from '../apps/renderer/src/app/ai/terminal-console';

describe('formatConsoleText', () => {
  it('handles empty input and removes trailing blank lines', () => {
    expect(formatConsoleText([])).toBe('');
    expect(formatConsoleText(['one  ', 'two\t', ''])).toBe('one\ntwo');
  });

  it('keeps only the last 200 lines', () => {
    const result = formatConsoleText(Array.from({ length: 201 }, (_, i) => String(i)));
    expect(result.split('\n')).toHaveLength(200);
    expect(result.split('\n')[0]).toBe('1');
  });

  it('strips control characters and ANSI escapes while preserving tabs', () => {
    expect(formatConsoleText(['a\x01\x1b[31mred\x1b[0m\tb\x7f'])).toBe('ared\tb');
  });

  it('caps at 8000 characters, keeping the tail without splitting a surrogate pair', () => {
    const result = formatConsoleText(['😀' + 'a'.repeat(8000)]);
    expect(Array.from(result)).toHaveLength(8000);
    expect(result.startsWith('a')).toBe(true);
    expect(result.endsWith('a')).toBe(true);
    expect(formatConsoleText(['x'.repeat(8001)])).toBe('x'.repeat(8000));
  });
});
