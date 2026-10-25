import { describe, expect, it, vi } from 'vitest';
import { listAiModels } from './models';

const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });

describe('listAiModels', () => {
  it('lists OpenAI-protocol models with a bearer token and sorts/dedupes ids', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response({ data: [{ id: 'b' }, { id: 'a' }, { id: 'a' }, { object: 'x' }, { id: 'whisper-1' }, { id: 'qwen3-asr-0.6b' }, { id: 'gpt-4o' }, { id: 'claude-sonnet' }, { id: 'tts-1' }] }));
    await expect(listAiModels({ provider: 'deepseek', token: 't', fetch: fetcher as typeof fetch })).resolves.toEqual([{ id: 'a' }, { id: 'b' }, { id: 'claude-sonnet' }, { id: 'gpt-4o' }, { id: 'tts-1' }]);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe('https://api.deepseek.com/v1/models');
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual({ authorization: 'Bearer t' });
  });

  it('uses the Anthropic headers and endpoint for claude', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response({ data: [{ id: 'claude-sonnet' }] }));
    await expect(listAiModels({ provider: 'claude', token: 'k', fetch: fetcher as typeof fetch })).resolves.toEqual([{ id: 'claude-sonnet' }]);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe('https://api.anthropic.com/v1/models');
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual({ 'x-api-key': 'k', 'anthropic-version': '2023-06-01' });
  });

  it('throws on provider errors and requires a base URL for compatible providers', async () => {
    const failing = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response({}, 401));
    await expect(listAiModels({ provider: 'openai', token: 't', fetch: failing as typeof fetch })).rejects.toThrow('HTTP 401');
    await expect(listAiModels({ provider: 'openai-compatible', token: 't' })).rejects.toThrow('base URL');
    await expect(listAiModels({ provider: 'none', token: 't' })).rejects.toThrow('not configured');
  });
});
