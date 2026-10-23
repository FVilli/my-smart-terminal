import { describe, expect, it, vi } from 'vitest';
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

function stores(cfg: AppConfig | undefined, token: string | null = 'secret-token') {
  return {
    configStore: { load: vi.fn(() => (cfg === undefined ? { status: 'missing' as const } : { status: 'valid' as const, config: cfg, restoredFromBackup: false })) },
    secrets: {
      isSecure: vi.fn(() => true),
      has: vi.fn(() => token !== null),
      get: vi.fn(() => token ?? undefined),
    },
  };
}

describe('AiService', () => {
  it('reports unconfigured without a provider or token', () => {
    expect(new AiService(stores(config({ aiProvider: 'none' })) as never).status()).toMatchObject({ configured: false, provider: 'none' });
    expect(new AiService(stores(config(), null) as never).status()).toMatchObject({ configured: false, hasToken: false });
  });

  it('corrects in test mode without network and preserves paths', async () => {
    const service = new AiService({ ...stores(config()), testMode: true });
    expect(service.status()).toMatchObject({ configured: true, hasToken: true });
    const result = await service.correct({ text: 'Questo e un testo con /tmp/x' });
    expect(result).toMatchObject({ changed: true, skipped: false, corrected: 'Questo è un testo con /tmp/x' });
  });

  it('skips shell commands and missing tokens without calling the provider', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    const shell = await new AiService({ ...stores(config()) }).correct({ text: 'git status' });
    expect(shell).toMatchObject({ skipped: true, reason: 'shell', corrected: 'git status' });
    const missing = await new AiService({ ...stores(config(), null) }).correct({ text: 'ciao mondo' });
    expect(missing).toMatchObject({ skipped: true, reason: 'missing-token' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses the configured provider and never returns the token', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://example.test/v1/chat/completions');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret-token');
      const body = JSON.parse(String(init?.body)) as { model: string; temperature: number };
      expect(body).toMatchObject({ model: 'test-model', temperature: 0 });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'testo corretto' } }] }), { status: 200 });
    });
    const service = new AiService({ ...stores(config({ aiBaseUrl: 'https://example.test/v1' })), fetch: fetcher as typeof fetch });
    const result = await service.correct({ text: 'testo da correggere' });
    expect(result).toMatchObject({ corrected: 'testo corretto', skipped: false });
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });

  it('falls back to the original on provider failure', async () => {
    const fetcher = vi.fn(async () => new Response('nope', { status: 500 }));
    const result = await new AiService({ ...stores(config()), fetch: fetcher as typeof fetch }).correct({ text: 'testo' });
    expect(result).toMatchObject({ corrected: 'testo', skipped: true, reason: 'provider-error' });
  });
});
