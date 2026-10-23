import { describe, expect, it } from 'vitest';
import { HELP_TOPICS } from '@smart-terminal/contracts';
import { HELP_URLS } from './help-topics';

describe('help topics', () => {
  it('maps every closed help topic to an HTTPS repository document', () => {
    expect(Object.keys(HELP_URLS).sort()).toEqual([...HELP_TOPICS].sort());
    for (const url of Object.values(HELP_URLS)) {
      expect(url.startsWith('https://github.com/FVilli/my-smart-terminal/blob/main/docs/')).toBe(true);
    }
  });
});
