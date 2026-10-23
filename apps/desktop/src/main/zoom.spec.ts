import { describe, expect, it } from 'vitest';
import { clampZoomFactor, resetZoomFactor, stepZoomFactor } from './zoom';

describe('zoom factors', () => {
  it('steps by ten percent and clamps to limits', () => {
    expect(stepZoomFactor(1, 1)).toBe(1.1);
    expect(stepZoomFactor(2, 1)).toBe(2);
    expect(stepZoomFactor(0.5, -1)).toBe(0.5);
    expect(clampZoomFactor(3)).toBe(2);
  });
  it('resets to 100 percent', () => expect(resetZoomFactor()).toBe(1));
});
