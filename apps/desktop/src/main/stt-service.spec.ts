import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from './app-config';
import { STT_TEST_TEXT, SttService } from './stt-service';

const config = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  machineName: 'host',
  dataRepoPath: '/tmp/data',
  aiProvider: 'none',
  sttProvider: 'local',
  sttCommand: '/opt/stt/transcribe',
  ...overrides,
});

const audio = (size = 32): Uint8Array => new Uint8Array(size).fill(7);

function stores(cfg: AppConfig | undefined, token: string | null = 'cloud-token') {
  return {
    configStore: {
      load: vi.fn(() =>
        cfg === undefined
          ? { status: 'missing' as const }
          : { status: 'valid' as const, config: cfg, restoredFromBackup: false },
      ),
    },
    secrets: {
      isSecure: vi.fn(() => true),
      has: vi.fn(() => token !== null),
      get: vi.fn(() => token ?? undefined),
    },
  };
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'st-stt-service-'));
afterAll(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('SttService', () => {
  it('reports unconfigured without config or provider', () => {
    expect(new SttService(stores(undefined) as never).status()).toMatchObject({ configured: false, provider: 'none', hasToken: false });
    expect(new SttService(stores(config({ sttProvider: 'none' })) as never).status()).toMatchObject({
      configured: false,
      provider: 'none',
    });
  });

  it('reports local provider configured only with a command', () => {
    const withCommand = new SttService(stores(config()) as never).status();
    expect(withCommand).toMatchObject({ configured: true, provider: 'local' });
    expect(withCommand.warning).toBeUndefined();
    const withoutCommand = new SttService(stores(config({ sttCommand: undefined })) as never).status();
    expect(withoutCommand).toMatchObject({ configured: false, provider: 'local' });
    expect(withoutCommand.warning).toContain('Local STT command');
  });

  it('reports cloud provider configured only with the stt:cloud token', () => {
    const configured = new SttService(stores(config({ sttProvider: 'cloud', sttCommand: undefined })) as never).status();
    expect(configured).toMatchObject({ configured: true, hasToken: true, secureStorage: true });
    const missing = new SttService(stores(config({ sttProvider: 'cloud' }), null) as never).status();
    expect(missing).toMatchObject({ configured: false, hasToken: false });
    expect(missing.warning).toContain('STT token');
    const secrets = stores(config({ sttProvider: 'cloud' }));
    new SttService(secrets as never).status();
    expect(secrets.secrets.has).toHaveBeenCalledWith('stt:cloud');
  });

  it('uses the selected AI provider URL and token for shared cloud STT', async () => {
    const secrets = stores(config({ sttProvider: 'cloud', sttUseAiProvider: true, aiProvider: 'openai-compatible', aiBaseUrl: 'https://llm.example/v1', sttBaseUrl: 'https://ignored.example/v1', sttCommand: undefined }));
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://llm.example/v1/audio/transcriptions');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer cloud-token');
      return new Response(JSON.stringify({ text: 'shared' }), { status: 200 });
    });
    const service = new SttService({ ...secrets, fetch: fetcher as typeof fetch });
    expect(service.status()).toMatchObject({ configured: true, hasToken: true });
    await expect(service.transcribe({ audio: audio(), mimeType: 'audio/webm' })).resolves.toEqual({ text: 'shared', skipped: false });
    expect(secrets.secrets.has).toHaveBeenCalledWith('ai:openai-compatible');
    expect(secrets.secrets.has).not.toHaveBeenCalledWith('stt:cloud');
  });

  it('rejects shared STT for unsupported AI providers', async () => {
    const service = new SttService(stores(config({ sttProvider: 'cloud', sttUseAiProvider: true, aiProvider: 'anthropic', sttCommand: undefined })) as never);
    expect(service.status()).toMatchObject({ configured: false, warning: expect.stringContaining('OpenAI-compatible') });
    await expect(service.transcribe({ audio: audio(), mimeType: 'audio/webm' })).resolves.toMatchObject({ skipped: true, reason: 'unconfigured' });
  });

  it('returns a fixed transcript in test mode without adapters, network or files', async () => {
    const run = vi.fn();
    const fetcher = vi.fn();
    const service = new SttService({ ...stores(config()), testMode: true, run, fetch: fetcher as never });
    expect(service.status()).toMatchObject({ configured: true, warning: 'STT test mode active.' });
    await expect(service.transcribe({ audio: audio(), mimeType: 'audio/webm' })).resolves.toEqual({
      text: STT_TEST_TEXT,
      skipped: false,
    });
    expect(run).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('validates audio size and mime type in test mode too', async () => {
    const service = new SttService({ ...stores(config()), testMode: true });
    expect(await service.transcribe({ audio: new Uint8Array(0), mimeType: 'audio/webm' })).toMatchObject({
      skipped: true,
      reason: 'invalid-audio',
    });
    expect(await service.transcribe({ audio: audio(), mimeType: 'video/webm' })).toMatchObject({
      skipped: true,
      reason: 'invalid-audio',
    });
    expect(await service.transcribe({ audio: 'no' as never, mimeType: 'audio/webm' })).toMatchObject({
      skipped: true,
      reason: 'invalid-audio',
    });
    expect(await service.transcribe({ audio: new Uint8Array(10 * 1024 * 1024 + 1), mimeType: 'audio/webm' })).toMatchObject({
      skipped: true,
      reason: 'invalid-audio',
    });
  });

  it('uses the configured local command and never leaks it in the result', async () => {
    const run = vi.fn(async (_file: string, _args: readonly string[], _input: Uint8Array, _timeoutMs: number) => ({
      stdout: ' local dictation ',
    }));
    const service = new SttService({ ...stores(config()), run });
    const result = await service.transcribe({ audio: audio(), mimeType: 'audio/webm' });
    expect(result).toEqual({ text: 'local dictation', skipped: false });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[0]).toBe('/opt/stt/transcribe');
    expect(JSON.stringify(result)).not.toContain('/opt/stt');
  });

  it('reads the cloud token from the secret store and never returns it', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.openai.com/v1/audio/transcriptions');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer cloud-token');
      return new Response(JSON.stringify({ text: 'cloud dictation' }), { status: 200 });
    });
    const service = new SttService({
      ...stores(config({ sttProvider: 'cloud', sttCommand: undefined })),
      fetch: fetcher as typeof fetch,
    });
    const result = await service.transcribe({ audio: audio(), mimeType: 'audio/webm' });
    expect(result).toEqual({ text: 'cloud dictation', skipped: false });
    expect(JSON.stringify(result)).not.toContain('cloud-token');
  });

  it('skips missing token and unconfigured provider without calling adapters', async () => {
    const fetcher = vi.fn();
    const run = vi.fn();
    const cloud = new SttService({
      ...stores(config({ sttProvider: 'cloud', sttCommand: undefined }), null),
      fetch: fetcher as never,
      run,
    });
    expect(await cloud.transcribe({ audio: audio(), mimeType: 'audio/webm' })).toMatchObject({
      skipped: true,
      reason: 'missing-token',
    });
    const none = new SttService({ ...stores(config({ sttProvider: 'none' })), run });
    expect(await none.transcribe({ audio: audio(), mimeType: 'audio/webm' })).toMatchObject({
      skipped: true,
      reason: 'unconfigured',
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
});
