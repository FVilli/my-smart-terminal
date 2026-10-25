import { describe, expect, it } from 'vitest';
import { AI_PLACEHOLDERS } from '@smart-terminal/contracts';
import { assertRenderedPromptSize, renderTemplate } from './placeholders';

describe('renderTemplate', () => {
  it('renders every placeholder and reports used and unknown names', () => {
    const values = Object.fromEntries(AI_PLACEHOLDERS.map((name) => [name, `value-${name}`]));
    const template = `${AI_PLACEHOLDERS.map((name) => `{{${name}}}`).join('|')}|{{mystery}}|{{mystery}}`;
    const result = renderTemplate(template, values);
    expect(result.text).toBe(`${AI_PLACEHOLDERS.map((name) => `value-${name}`).join('|')}|{{mystery}}|{{mystery}}`);
    expect(result.used).toEqual([...AI_PLACEHOLDERS]);
    expect(result.unknown).toEqual(['mystery']);
  });

  it('uses defaults for missing values and does not recursively substitute', () => {
    const result = renderTemplate(AI_PLACEHOLDERS.map((name) => `{{${name}}}`).join('|'), { composer: '{{os}}' });
    expect(result.text).toContain('{{os}}');
    expect(result.text).toContain('unknown');
    expect(result.text).toBe('unknown|unknown|unknown|||{{os}}||||');
  });

  it('enforces the combined rendered prompt limit', () => {
    expect(() => assertRenderedPromptSize('a'.repeat(32 * 1024 + 1), '')).toThrow(expect.objectContaining({ name: 'INVALID_ACTION' }));
  });
});
