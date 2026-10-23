import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { STT_MAX_AUDIO_BYTES } from '@smart-terminal/contracts';
import {
  LocalSttAdapter,
  OpenAiSttAdapter,
  isAudioMimeType,
  isValidSttAudio,
  transcribeAudio,
  type SttProcessRunner,
} from './index';

const audio = (size = 64): Uint8Array => new TextEncoder().encode('x'.repeat(size));

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'st-ai-stt-'));
afterAll(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

/** Real executable: writes the arguments and the length of audio read from stdin to stdout. */
function fakeSttScript(name: string, body: string): string {
  const file = path.join(tempRoot, name);
  fs.writeFileSync(file, body, { mode: 0o755 });
  return file;
}

describe('STT validation', () => {
  it('accepts audio/* mime types and bounded audio', () => {
    expect(isAudioMimeType('audio/webm')).toBe(true);
    expect(isAudioMimeType('audio/ogg')).toBe(true);
    expect(isAudioMimeType('audio/webm;codecs=opus')).toBe(false);
    expect(isAudioMimeType('video/webm')).toBe(false);
    expect(isAudioMimeType('audio//x')).toBe(false);
    expect(isValidSttAudio(audio())).toBe(true);
    expect(isValidSttAudio(new Uint8Array(0))).toBe(false);
    expect(isValidSttAudio(new Uint8Array(STT_MAX_AUDIO_BYTES + 1))).toBe(false);
    expect(isValidSttAudio('audio')).toBe(false);
  });
});

describe('LocalSttAdapter', () => {
  it('runs the absolute command with audio on stdin and writes no temporary file', async () => {
    const command = fakeSttScript('local-stt', '#!/bin/sh\nwc -c | tr -d " "\n');
    const before = fs.readdirSync(tempRoot).sort();
    const adapter = new LocalSttAdapter(command);
    const text = await adapter.transcribe({ audio: audio(32), mimeType: 'audio/webm' }, { timeoutMs: 5000 });
    expect(text).toBe('32');
    // No temporary audio file: the script directory remains unchanged.
    expect(fs.readdirSync(tempRoot).sort()).toEqual(before);
  });

  it('keeps arguments separated (no shell interpretation)', async () => {
    const received: { file: string; args: readonly string[]; input: Uint8Array }[] = [];
    const run: SttProcessRunner = async (file, args, input) => {
      received.push({ file, args, input });
      return { stdout: '  dictated  \n' };
    };
    const adapter = new LocalSttAdapter('/opt/stt/transcribe', ['--model', 'small; rm -rf /'], run);
    await expect(adapter.transcribe({ audio: audio(8), mimeType: 'audio/wav' }, { timeoutMs: 1000 })).resolves.toBe('dictated');
    expect(received[0]?.file).toBe('/opt/stt/transcribe');
    expect(received[0]?.args).toEqual(['--model', 'small; rm -rf /']);
    expect(received[0]?.input.byteLength).toBe(8);
  });

  it('refuses a relative command without executing anything', async () => {
    const run = vi.fn<SttProcessRunner>();
    await expect(new LocalSttAdapter('stt', [], run).transcribe({ audio: audio(), mimeType: 'audio/webm' }, { timeoutMs: 10 })).rejects.toThrow('unsupported');
    expect(run).not.toHaveBeenCalled();
  });

  it('surfaces a timeout and a provider error through the orchestrator', async () => {
    const timeoutRun: SttProcessRunner = () =>
      Promise.reject(Object.assign(new Error('Command failed: killed'), { killed: true }));
    const timedOut = await transcribeAudio({ provider: 'local', command: '/opt/stt', audio: audio(), mimeType: 'audio/webm', run: timeoutRun });
    expect(timedOut).toMatchObject({ skipped: true, reason: 'timeout' });
    const failing = await transcribeAudio({ provider: 'local', command: '/opt/stt', audio: audio(), mimeType: 'audio/webm', run: () => Promise.reject(new Error('boom')) });
    expect(failing).toMatchObject({ skipped: true, reason: 'provider-error' });
  });

  it('really times out a slow local command', async () => {
    const command = fakeSttScript('slow-stt', '#!/bin/sh\nsleep 5\necho tardi\n');
    const result = await transcribeAudio({ provider: 'local', command, audio: audio(4), mimeType: 'audio/webm', timeoutMs: 200 });
    expect(result).toMatchObject({ skipped: true, reason: 'timeout' });
  });
});

describe('OpenAiSttAdapter', () => {
  it('posts multipart audio to the default endpoint with the bearer token', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.openai.com/v1/audio/transcriptions');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer cloud-token');
      const body = init?.body as FormData;
      expect(body).toBeInstanceOf(FormData);
      expect(body.get('model')).toBe('whisper-1');
      const file = body.get('file') as File;
      expect(file.type).toBe('audio/webm');
      expect(file.size).toBe(16);
      return new Response(JSON.stringify({ text: '  ciao mondo  ' }), { status: 200 });
    });
    const adapter = new OpenAiSttAdapter({ token: 'cloud-token', fetch: fetcher as typeof fetch });
    await expect(adapter.transcribe({ audio: audio(16), mimeType: 'audio/webm' }, { timeoutMs: 5000 })).resolves.toBe('ciao mondo');
  });

  it('honours a custom base URL, model and language', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://stt.test/v1/audio/transcriptions');
      const body = init?.body as FormData;
      expect(body.get('model')).toBe('whisper-test');
      expect(body.get('language')).toBe('it');
      return new Response(JSON.stringify({ text: 'ok' }), { status: 200 });
    });
    const adapter = new OpenAiSttAdapter({ token: 't', baseUrl: 'https://stt.test/v1/', model: 'whisper-test', fetch: fetcher as typeof fetch });
    await expect(adapter.transcribe({ audio: audio(4), mimeType: 'audio/wav', language: 'it' }, { timeoutMs: 5000 })).resolves.toBe('ok');
  });

  it('maps provider failures, empty transcripts and timeouts without leaking the token', async () => {
    const failing = await transcribeAudio({
      provider: 'cloud',
      token: 'secret-token',
      audio: audio(),
      mimeType: 'audio/webm',
      fetch: (async () => new Response('no', { status: 401 })) as unknown as typeof fetch,
    });
    expect(failing).toMatchObject({ skipped: true, reason: 'provider-error' });
    expect(JSON.stringify(failing)).not.toContain('secret-token');
    const empty = await transcribeAudio({
      provider: 'cloud',
      token: 'secret-token',
      audio: audio(),
      mimeType: 'audio/webm',
      fetch: (async () => new Response(JSON.stringify({ text: '   ' }))) as unknown as typeof fetch,
    });
    expect(empty).toMatchObject({ skipped: true, reason: 'empty' });
    const timeout = await transcribeAudio({
      provider: 'cloud',
      token: 'secret-token',
      audio: audio(),
      mimeType: 'audio/webm',
      timeoutMs: 10,
      fetch: ((_url: string | URL | Request, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        })) as unknown as typeof fetch,
    });
    expect(timeout).toMatchObject({ skipped: true, reason: 'timeout' });
    expect(JSON.stringify(timeout)).not.toContain('secret-token');
  });
});

describe('transcribeAudio orchestrator', () => {
  it('skips unconfigured providers, missing tokens and invalid audio without calling adapters', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    expect(await transcribeAudio({ provider: 'none', audio: audio(), mimeType: 'audio/webm' })).toMatchObject({ skipped: true, reason: 'unconfigured' });
    expect(await transcribeAudio({ provider: 'local', audio: audio(), mimeType: 'audio/webm' })).toMatchObject({ skipped: true, reason: 'unconfigured' });
    expect(await transcribeAudio({ provider: 'cloud', audio: audio(), mimeType: 'audio/webm' })).toMatchObject({ skipped: true, reason: 'missing-token' });
    expect(
      await transcribeAudio({ provider: 'local', command: 'relativo/stt', audio: audio(), mimeType: 'audio/webm' }),
    ).toMatchObject({ skipped: true, reason: 'unsupported' });
    expect(await transcribeAudio({ provider: 'local', command: '/opt/stt', audio: new Uint8Array(0), mimeType: 'audio/webm' })).toMatchObject({
      skipped: true,
      reason: 'invalid-audio',
    });
    expect(
      await transcribeAudio({ provider: 'local', command: '/opt/stt', audio: audio(), mimeType: 'text/plain' }),
    ).toMatchObject({ skipped: true, reason: 'invalid-audio' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('trims the local transcript and never returns the token', async () => {
    const result = await transcribeAudio({
      provider: 'local',
      command: '/opt/stt',
      audio: audio(12),
      mimeType: 'audio/webm',
      run: async () => ({ stdout: '  local text \n' }),
    });
    expect(result).toEqual({ text: 'local text', skipped: false });
  });
});
