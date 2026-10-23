import { execFile } from 'node:child_process';
import path from 'node:path';
import { STT_MAX_AUDIO_BYTES, type SttProvider, type SttSkipReason } from '@smart-terminal/contracts';

export interface SttRequest {
  audio: Uint8Array;
  mimeType: string;
  language?: string;
  responseFormat?: 'json' | 'verbose_json';
}

export interface SttResult {
  text: string;
  skipped: boolean;
  reason?: SttSkipReason;
}

export interface SttAdapter {
  transcribe(request: SttRequest, options: { timeoutMs: number }): Promise<string>;
}

/** Runs a process with audio on stdin (never a shell, never an audio file on disk). */
export type SttProcessRunner = (
  file: string,
  args: readonly string[],
  input: Uint8Array,
  timeoutMs: number,
) => Promise<{ stdout: string }>;

export const STT_DEFAULT_TIMEOUT_MS = 30_000;

const AUDIO_MIME_PATTERN = /^audio\/[a-z0-9][a-z0-9.+-]{0,63}$/i;

/** `audio/*` with a plausible subtype: no parameters, paths, or control characters. */
export function isAudioMimeType(value: unknown): value is string {
  return typeof value === 'string' && AUDIO_MIME_PATTERN.test(value);
}

export function isValidSttAudio(audio: unknown): audio is Uint8Array {
  return audio instanceof Uint8Array && audio.byteLength > 0 && audio.byteLength <= STT_MAX_AUDIO_BYTES;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const killed = (error as { killed?: unknown }).killed === true || (error as { code?: unknown }).code === 'ETIMEDOUT';
  return error.name === 'AbortError' || killed || /timed?\s?out/i.test(error.message);
}

/** `execFile` as the default runner: separate arguments, no shell, stdin containing audio bytes. */
export const execFileSttRunner: SttProcessRunner = (file, args, input, timeoutMs) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      file,
      [...args],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8', windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout: String(stdout) });
      },
    );
    child.stdin?.on('error', () => undefined);
    child.stdin?.end(Buffer.from(input));
  });

/** Local STT: absolute executable command, audio via stdin, no temporary files. */
export class LocalSttAdapter implements SttAdapter {
  constructor(
    private readonly command: string,
    private readonly args: readonly string[] = [],
    private readonly run: SttProcessRunner = execFileSttRunner,
  ) {}

  async transcribe(request: SttRequest, options: { timeoutMs: number }): Promise<string> {
    if (!path.isAbsolute(this.command)) {
      throw new Error('unsupported');
    }
    const { stdout } = await this.run(this.command, this.args, request.audio, options.timeoutMs);
    return stdout.trim();
  }
}

export interface OpenAiSttOptions {
  token: string;
  baseUrl?: string;
  model?: string;
  responseFormat?: 'json' | 'verbose_json';
  fetch?: typeof fetch;
}

function transcriptionEndpoint(baseUrl?: string): string {
  return `${(baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/audio/transcriptions`;
}

/** OpenAI-compatible cloud STT: multipart to `<base>/audio/transcriptions`, default model `whisper-1`. */
export class OpenAiSttAdapter implements SttAdapter {
  constructor(private readonly options: OpenAiSttOptions) {}

  async transcribe(request: SttRequest, options: { timeoutMs: number }): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const form = new FormData();
      form.append('file', new Blob([request.audio], { type: request.mimeType }), 'audio');
      form.append('model', this.options.model || 'whisper-1');
      form.append('response_format', request.responseFormat ?? this.options.responseFormat ?? 'json');
      if (request.language !== undefined) {
        form.append('language', request.language);
      }
      const call = this.options.fetch ?? fetch;
      const response = await call(transcriptionEndpoint(this.options.baseUrl), {
        method: 'POST',
        headers: { authorization: `Bearer ${this.options.token}` },
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error('provider-error');
      }
      const data: unknown = await response.json();
      const text = (data as { text?: unknown }).text;
      return typeof text === 'string' ? text.trim() : '';
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface TranscribeAudioRequest extends SttRequest {
  provider: SttProvider;
  /** Cloud token (`stt:cloud`), read by the main process. */
  token?: string;
  /** Absolute command for the local provider. */
  command?: string;
  baseUrl?: string;
  model?: string;
  responseFormat?: 'json' | 'verbose_json';
  timeoutMs?: number;
  fetch?: typeof fetch;
  run?: SttProcessRunner;
}

/**
 * STT orchestrator: never throws and never includes audio/token in results.
 * Errors become `skipped` with a stable reason used by the renderer for the message.
 */
export async function transcribeAudio(request: TranscribeAudioRequest): Promise<SttResult> {
  const skipped = (reason: SttSkipReason): SttResult => ({ text: '', skipped: true, reason });
  if (!isValidSttAudio(request.audio) || !isAudioMimeType(request.mimeType)) {
    return skipped('invalid-audio');
  }
  if (request.provider === 'none') {
    return skipped('unconfigured');
  }
  let adapter: SttAdapter;
  if (request.provider === 'local') {
    if (request.command === undefined || request.command.trim().length === 0) {
      return skipped('unconfigured');
    }
    if (!path.isAbsolute(request.command)) {
      return skipped('unsupported');
    }
    adapter = new LocalSttAdapter(request.command, [], request.run);
  } else if (request.provider === 'cloud') {
    if (request.token === undefined || request.token.length === 0) {
      return skipped('missing-token');
    }
    adapter = new OpenAiSttAdapter({
      token: request.token,
      ...(request.baseUrl !== undefined ? { baseUrl: request.baseUrl } : {}),
      ...(request.model !== undefined ? { model: request.model } : {}),
      ...(request.responseFormat !== undefined ? { responseFormat: request.responseFormat } : {}),
      ...(request.fetch !== undefined ? { fetch: request.fetch } : {}),
    });
  } else {
    return skipped('unsupported');
  }
  try {
    const sttRequest: SttRequest = {
      audio: request.audio,
      mimeType: request.mimeType,
      ...(request.language !== undefined ? { language: request.language } : {}),
    };
    const text = (await adapter.transcribe(sttRequest, { timeoutMs: request.timeoutMs ?? STT_DEFAULT_TIMEOUT_MS })).trim();
    return text.length === 0 ? skipped('empty') : { text, skipped: false };
  } catch (error) {
    return skipped(isTimeoutError(error) ? 'timeout' : 'provider-error');
  }
}
