import { describe, expect, it, vi } from 'vitest';
import { correctText, isShellCommand } from './index';

describe('AI correction', () => {
  it('skips likely shell commands and accepts prose', async () => {
    expect(isShellCommand('git status')).toBe(true);
    expect(isShellCommand('please fix the grammer in this sentence')).toBe(false);
    expect((await correctText({ provider: 'none', text: 'hello' })).reason).toBe('unconfigured');
  });
  it('uses OpenAI-compatible endpoint and safely returns corrected text', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://example.test/v1/chat/completions');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret');
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Corrected /some/path --flag' } }] }), { status: 200 });
    });
    const result = await correctText({ provider: 'openai-compatible', baseUrl: 'https://example.test/v1', token: 'secret', text: 'fix this', fetch: fetcher as typeof fetch });
    expect(result.corrected).toBe('Corrected /some/path --flag');
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('falls back on errors and empty responses', async () => {
    const empty = await correctText({ provider: 'openai', token: 'secret', text: 'hello', fetch: vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: ' ' } }] }))) as typeof fetch });
    expect(empty).toMatchObject({ corrected: 'hello', skipped: true, reason: 'empty' });
    const failed = await correctText({ provider: 'openai', token: 'secret', text: 'hello', fetch: vi.fn(async () => new Response('private', { status: 500 })) as typeof fetch });
    expect(failed).toMatchObject({ corrected: 'hello', skipped: true, reason: 'provider-error' });
  });
});

describe('AI provider adapters', () => {
  it('sends Anthropic headers/body and parses content', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.anthropic.com/v1/messages');
      const headers = new Headers(init?.headers);
      expect(headers.get('x-api-key')).toBe('anthropic-token');
      expect(headers.get('anthropic-version')).toBe('2023-06-01');
      const body = JSON.parse(String(init?.body)) as { model: string; messages: { content: string }[] };
      expect(body.model).toBe('claude-test');
      expect(body.messages[0]?.content).toContain('--- INIZIO TESTO ---');
      return new Response(JSON.stringify({ content: [{ text: 'corretto /tmp/a --flag' }] }), { status: 200 });
    });
    const result = await correctText({ provider: 'anthropic', token: 'anthropic-token', model: 'claude-test', text: 'fix typos', fetch: fetcher as typeof fetch });
    expect(result.corrected).toBe('corretto /tmp/a --flag');
  });

  it('sends OpenAI headers/body with temperature 0', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.openai.com/v1/chat/completions');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer openai-token');
      expect(JSON.parse(String(init?.body))).toMatchObject({ temperature: 0 });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    });
    await expect(correctText({ provider: 'openai', token: 'openai-token', text: 'fix typos', fetch: fetcher as typeof fetch })).resolves.toMatchObject({ corrected: 'ok' });
  });

  it('falls back on timeout without leaking the token', async () => {
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));
    const result = await correctText({ provider: 'openai', token: 'timeout-token', text: 'fix typos', timeoutMs: 10, fetch: fetcher as typeof fetch });
    expect(result).toMatchObject({ corrected: 'fix typos', skipped: true, reason: 'timeout' });
    expect(JSON.stringify(result)).not.toContain('timeout-token');
  });
});
