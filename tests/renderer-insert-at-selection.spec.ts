import { describe, expect, it } from 'vitest';
import { insertAtSelection } from '../apps/renderer/src/app/assisted-input/insert-at-selection';

describe('insertAtSelection', () => {
  it('inserts at the caret and returns the new caret', () => {
    expect(insertAtSelection('echo ', 'ls', 5, 5)).toEqual({ value: 'echo ls', caret: 7 });
  });

  it('replaces the selected range and keeps surrounding text', () => {
    expect(insertAtSelection('alpha beta gamma', 'X', 6, 10)).toEqual({ value: 'alpha X gamma', caret: 7 });
  });

  it('inserts multi-line text verbatim without padding by default', () => {
    const result = insertAtSelection('a', 'line1\nline2', 1, 1);
    expect(result).toEqual({ value: 'aline1\nline2', caret: 12 });
  });

  it('pads words for speech transcripts but not for AI answers', () => {
    expect(insertAtSelection('echo', 'ls', 4, 4, { padWords: true })).toEqual({ value: 'echo ls', caret: 7 });
    expect(insertAtSelection('echo', 'ls', 4, 4)).toEqual({ value: 'echols', caret: 6 });
    expect(insertAtSelection('a b', 'x', 1, 2, { padWords: true })).toEqual({ value: 'a x b', caret: 3 });
  });

  it('rejects empty text, normalizes CRLF and enforces maxLength', () => {
    expect(insertAtSelection('abc', '   ', 1, 1)).toBeNull();
    expect(insertAtSelection('abc', 'x\r\ny', 3, 3)).toEqual({ value: 'abcx\ny', caret: 6 });
    expect(insertAtSelection('abc', 'xxxx', 3, 3, { maxLength: 5 })).toBeNull();
  });
});
