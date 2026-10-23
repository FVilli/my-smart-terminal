import { describe, expect, it, vi } from 'vitest';
import { copyTerminalSelection, isTerminalCopyShortcut } from './terminal-copy';

describe('terminal copy shortcuts', () => {
  it('detects Ctrl+Shift+C, Cmd+C, and Ctrl+Insert', () => {
    expect(isTerminalCopyShortcut({ key: 'c', ctrlKey: true, shiftKey: true, metaKey: false })).toBe(true);
    expect(isTerminalCopyShortcut({ key: 'c', ctrlKey: false, shiftKey: false, metaKey: true })).toBe(true);
    expect(isTerminalCopyShortcut({ key: 'Insert', ctrlKey: true, shiftKey: false, metaKey: false })).toBe(true);
  });

  it('does not copy without a selection', async () => {
    const write = vi.fn();
    expect(await copyTerminalSelection('', write)).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it('writes selected text and absorbs clipboard errors', async () => {
    const write = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    expect(await copyTerminalSelection('selected text', write)).toBe(true);
    expect(write).toHaveBeenCalledWith({ text: 'selected text' });
  });
});
