import { describe, expect, it, vi } from 'vitest';
import { createHelpService } from './help-service';

describe('help service', () => {
  it('returns success when the browser launches', async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const service = createHelpService({ openExternal });
    const result = await service.open('repository');
    expect(result).toEqual({ opened: true, url: expect.stringContaining('/docs/') });
    expect(openExternal).toHaveBeenCalledWith(result.url);
  });

  it('returns fallback result and sanitized log on launch failure', async () => {
    const log = vi.fn();
    const service = createHelpService({ openExternal: vi.fn().mockRejectedValue(new Error('secret')), log });
    expect(await service.open('repository')).toEqual({ opened: false, url: expect.stringContaining('/docs/') });
    expect(log).toHaveBeenCalledWith('external-open-failed');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
  });
});
