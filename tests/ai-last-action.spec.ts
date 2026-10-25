import { describe, expect, it } from 'vitest';
import { readLastAction, writeLastAction } from '../apps/renderer/src/app/ai/ai-last-action';

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('AI last action persistence', () => {
  it('reads and writes the selected action id', () => {
    const fake = storage();
    expect(readLastAction(fake)).toBeNull();
    writeLastAction(fake, 'fix-message');
    expect(readLastAction(fake)).toBe('fix-message');
  });
  it('returns null for malformed values and storage failures', () => {
    expect(readLastAction(storage({ 'smart-terminal.ai-last-action': '' }))).toBeNull();
    expect(readLastAction({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} })).toBeNull();
    expect(() => writeLastAction({ getItem: () => null, setItem: () => { throw new Error('blocked'); } }, 'x')).not.toThrow();
  });
});
