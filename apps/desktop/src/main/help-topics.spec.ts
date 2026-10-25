import { describe, expect, it } from 'vitest';
import { HELP_TOPICS } from '@smart-terminal/contracts';
import { HELP_URLS, helpUrl, isAllowedHelpUrl } from './help-topics';

describe('help topics', () => {
  it('maps every closed help topic to an HTTPS repository document', () => {
    expect(Object.keys(HELP_URLS).sort()).toEqual([...HELP_TOPICS].sort());
    for (const url of Object.values(HELP_URLS)) {
      expect(url.startsWith('https://github.com/FVilli/my-smart-terminal/blob/main/docs/')).toBe(true);
    }
  });

  it('allows only HTTPS guide URLs under the repository docs path', () => {
    expect(isAllowedHelpUrl(HELP_URLS.repository)).toBe(true);
    expect(isAllowedHelpUrl('http://github.com/FVilli/my-smart-terminal/blob/main/docs/a.md')).toBe(false);
    expect(isAllowedHelpUrl('https://github.com.evil.test/FVilli/my-smart-terminal/blob/main/docs/a')).toBe(false);
    expect(isAllowedHelpUrl('https://github.com/FVilli/my-smart-terminal/blob/main/README.md')).toBe(false);
    expect(() => helpUrl('invalid')).toThrowError(expect.objectContaining({ code: 'HELP_UNKNOWN_TOPIC' }));
  });
});
