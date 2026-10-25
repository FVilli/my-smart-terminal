import { describe, expect, it } from 'vitest';
import { SETTINGS_TABS, nextTabIndex } from '../apps/renderer/src/app/ui/tabs.logic';

describe('nextTabIndex', () => {
  it('moves with arrows and wraps around', () => {
    expect(nextTabIndex(1, 3, 'ArrowRight')).toBe(2);
    expect(nextTabIndex(2, 3, 'ArrowRight')).toBe(0);
    expect(nextTabIndex(0, 3, 'ArrowLeft')).toBe(2);
  });
  it('moves to endpoints and ignores unknown keys', () => {
    expect(nextTabIndex(2, 4, 'Home')).toBe(0);
    expect(nextTabIndex(0, 4, 'End')).toBe(3);
    expect(nextTabIndex(0, 4, 'Enter')).toBe(-1);
  });
});

describe('settings tabs metadata', () => {
  it('keeps ids, labels, and test ids in settings step order', () => {
    expect(SETTINGS_TABS.map(({ id, label, testId }) => [id, label, testId])).toEqual([
      ['repository', 'Repository', 'settings-tab-repository'], ['ai', 'AI', 'settings-tab-ai'],
      ['stt', 'STT', 'settings-tab-stt'], ['appearance', 'Appearance', 'settings-tab-appearance'],
    ]);
  });
});
