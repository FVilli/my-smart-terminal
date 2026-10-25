import { describe, expect, it, vi } from 'vitest';
import { stubStores } from './testing/stores';
import type { AppConfig } from './app-config';
import { AiService } from './ai-service';

const config = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  machineName: 'host',
  dataRepoPath: '/tmp/data',
  aiProvider: 'openai',
  aiModel: 'test-model',
  sttProvider: 'none',
  ...overrides,
});

describe('AiService', () => {
  it('reports unconfigured without a provider or token', () => {
    expect(new AiService(stubStores(config({ aiProvider: 'none' }), 'secret-token') as never).status()).toMatchObject({ configured: false, provider: 'none' });
    expect(new AiService(stubStores(config(), null) as never).status()).toMatchObject({ configured: false, hasToken: false });
  });

  it('corrects in test mode without network and preserves paths', async () => {
    const service = new AiService({ ...stubStores(config(), 'secret-token'), testMode: true });
    expect(service.status()).toMatchObject({ configured: true, hasToken: true });
    const result = await service.correct({ text: 'This is a sentance with /tmp/x' });
    expect(result).toMatchObject({ changed: true, skipped: false, corrected: 'This is a sentence with /tmp/x' });
  });

  it('skips shell commands and missing tokens without calling the provider', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    const shell = await new AiService({ ...stubStores(config(), 'secret-token') }).correct({ text: 'git status' });
    expect(shell).toMatchObject({ skipped: true, reason: 'shell', corrected: 'git status' });
    const missing = await new AiService({ ...stubStores(config(), null) }).correct({ text: 'ciao mondo' });
    expect(missing).toMatchObject({ skipped: true, reason: 'missing-token' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses the configured provider and never returns the token', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://example.test/v1/chat/completions');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret-token');
      const body = JSON.parse(String(init?.body)) as { model: string; temperature: number };
      expect(body).toMatchObject({ model: 'test-model', temperature: 0 });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'corrected text' } }] }), { status: 200 });
    });
    const service = new AiService({ ...stubStores(config({ aiBaseUrl: 'https://example.test/v1' }), 'secret-token'), fetch: fetcher as typeof fetch });
    const result = await service.correct({ text: 'text to correct' });
    expect(result).toMatchObject({ corrected: 'corrected text', skipped: false });
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });

  it('falls back to the original on provider failure with a sanitized status', async () => {
    const fetcher = vi.fn(async () => new Response('nope', { status: 500 }));
    const result = await new AiService({ ...stubStores(config(), 'secret-token'), fetch: fetcher as typeof fetch }).correct({ text: 'text' });
    expect(result).toMatchObject({ corrected: 'text', skipped: true, reason: 'provider-error', error: 'HTTP 500' });
    expect(JSON.stringify(result)).not.toContain('secret-token');
    expect(JSON.stringify(result)).not.toContain('nope');
  });
});

describe('AiService connection test', () => {
  it('reports a deterministic success in test mode', async () => {
    const service = new AiService({ ...stubStores(config(), 'secret-token'), testMode: true });
    await expect(service.testConnection()).resolves.toMatchObject({ ok: true, provider: 'openai', response: 'OK' });
  });

  it('tests the current unsaved wizard values and entered token', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://unsloth.example/v1/chat/completions');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer sk-unsloth-entered');
      return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), { status: 200 });
    });
    const result = await new AiService({ ...stubStores(config({ aiProvider: 'none' }), null), fetch: fetcher as typeof fetch }).testConnection({
      config: { machineName: 'host', dataRepoPath: '/tmp/data', aiProvider: 'openai-compatible', aiBaseUrl: 'https://unsloth.example/v1', aiModel: 'unsloth/gemma-test:UD', sttProvider: 'none' },
      aiToken: 'sk-unsloth-entered',
    });
    expect(result).toMatchObject({ ok: true, provider: 'openai-compatible' });
    expect(JSON.stringify(result)).not.toContain('sk-unsloth-entered');
  });

  it('reports a sanitized HTTP status from Test AI', async () => {
    const fetcher = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    const result = await new AiService({ ...stubStores(config({ aiBaseUrl: 'https://example.test/v1' }), 'secret-token'), fetch: fetcher as typeof fetch }).testConnection();
    expect(result).toMatchObject({ ok: false, error: 'HTTP 401' });
    expect(JSON.stringify(result)).not.toContain('secret-token');
    expect(JSON.stringify(result)).not.toContain('unauthorized');
  });

  it('reports unconfigured and missing-token states', async () => {
    await expect(new AiService(stubStores(config({ aiProvider: 'none' }), 'secret-token') as never).testConnection()).resolves.toMatchObject({ ok: false, provider: 'none' });
    await expect(new AiService(stubStores(config(), null) as never).testConnection()).resolves.toMatchObject({ ok: false, error: 'AI token is not configured.' });
  });

  it('composes prompts with the session environment and no network', () => {
    const service = new AiService({ ...stubStores(config(), 'secret-token') });
    const result = service.compose({ action: 'assess-risk', input: 'rm -rf build', environment: { os: 'linux', shell: 'bash', source: 'local' } });
    expect(result.prompt).toContain('Context: os=linux; shell=bash; source=local');
    expect(result.prompt).toContain('<user_body>\nrm -rf build\n</user_body>');
  });

  it('runs actions deterministically in test mode and skips when unconfigured', async () => {
    const service = new AiService({ ...stubStores(config(), 'secret-token'), testMode: true });
    await expect(service.action({ action: 'suggest-command', prompt: 'list files' })).resolves.toMatchObject({ text: 'echo ok', skipped: false });
    await expect(service.action({ action: 'assess-risk', prompt: 'rm' })).resolves.toMatchObject({ text: expect.stringContaining('Risk: low') });
    const unconfigured = new AiService({ ...stubStores(config({ aiProvider: 'none' }), 'secret-token'), testMode: true });
    await expect(unconfigured.action({ action: 'fix-message', prompt: 'x' })).resolves.toMatchObject({ skipped: true, reason: 'unconfigured' });
    const noToken = new AiService({ ...stubStores(config(), null) });
    await expect(noToken.action({ action: 'fix-message', prompt: 'x' })).resolves.toMatchObject({ skipped: true, reason: 'missing-token' });
  });

  it('calls the provider for actions and sanitizes HTTP failures', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'answer' } }] }), { status: 200 }));
    const service = new AiService({ ...stubStores(config(), 'secret-token'), fetch: fetchMock as typeof fetch });
    await expect(service.action({ action: 'explain-command', prompt: 'ls' })).resolves.toMatchObject({ text: 'answer', skipped: false });
    const failing = vi.fn(async () => new Response('raw provider body', { status: 429 }));
    const failedService = new AiService({ ...stubStores(config(), 'secret-token'), fetch: failing as typeof fetch });
    const failed = await failedService.action({ action: 'explain-command', prompt: 'ls' });
    expect(failed).toMatchObject({ skipped: true, reason: 'provider-error', error: 'HTTP 429' });
    expect(JSON.stringify(failed)).not.toContain('raw provider body');
  });

  it('blocks prompts containing secrets before the provider or test mode', async () => {
    const fetchMock = vi.fn();
    const live = new AiService({ ...stubStores(config(), 'secret-token'), fetch: fetchMock as typeof fetch });
    await expect(live.action({ action: 'fix-message', prompt: 'password: hunter2' })).resolves.toMatchObject({ skipped: true, reason: 'sensitive' });
    const testMode = new AiService({ ...stubStores(config(), 'secret-token'), testMode: true });
    await expect(testMode.action({ action: 'fix-message', prompt: '-----BEGIN PRIVATE KEY-----\nxxx' })).resolves.toMatchObject({ skipped: true, reason: 'sensitive' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps aborted provider requests to a timeout without leaking details', async () => {
    const aborting = vi.fn(async () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
    const service = new AiService({ ...stubStores(config(), 'secret-token'), fetch: aborting as typeof fetch });
    const result = await service.action({ action: 'explain-command', prompt: 'ls' });
    expect(result).toMatchObject({ skipped: true, reason: 'timeout' });
  });
});
