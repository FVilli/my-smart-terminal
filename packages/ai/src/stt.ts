import { execFile } from 'node:child_process';
import path from 'node:path';
import { STT_MAX_AUDIO_BYTES, type SttDiagnostics, type SttProvider, type SttSkipReason } from '@smart-terminal/contracts';

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
  diagnostics?: SttDiagnostics;
}

export class SttHttpError extends Error {
  constructor(readonly httpStatus: number, readonly contentType?: string, readonly providerMessage?: string) { super(`HTTP ${httpStatus}`); this.name = 'SttHttpError'; }
}

function safeProviderMessage(body: string, token?: string): string | undefined {
  let message: unknown;
  try {
    const data = JSON.parse(body) as { error?: { message?: unknown } | string; message?: unknown; detail?: unknown };
    message = typeof data.error === 'object' && data.error !== null ? data.error.message : typeof data.error === 'string' ? data.error : data.message ?? data.detail;
  } catch { return undefined; }
  if (typeof message !== 'string') return undefined;
  let safe = message.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (token !== undefined && token.length > 0) safe = safe.replaceAll(token, '[redacted]');
  safe = safe.replace(/sk-[A-Za-z0-9._-]+/g, '[redacted]');
  return safe.length > 0 ? safe : undefined;
}

export class SttJsonError extends Error {
  constructor(readonly httpStatus: number, readonly contentType?: string) { super('invalid JSON'); this.name = 'SttJsonError'; }
}

function endpointForDiagnostics(baseUrl?: string): string | undefined {
  if (baseUrl === undefined) return undefined;
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, '')}/audio/transcriptions`;
  } catch { return undefined; }
}

/** Coarse network classification for diagnostics: never leaks URLs, bodies or credentials. */
function networkCategory(error: unknown): string {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (code === 'ECONNREFUSED') return 'connection refused';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DNS failure';
  if (typeof code === 'string' && /CERT|TLS|SSL/.test(code)) return 'TLS failure';
  return 'network error';
}

export interface SttAdapterResult { text: string; httpStatus?: number; contentType?: string; jsonValid?: boolean; }
export interface SttAdapter {
  transcribe(request: SttRequest, options: { timeoutMs: number }): Promise<SttAdapterResult>;
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

  async transcribe(request: SttRequest, options: { timeoutMs: number }): Promise<SttAdapterResult> {
    if (!path.isAbsolute(this.command)) {
      throw new Error('unsupported');
    }
    const { stdout } = await this.run(this.command, this.args, request.audio, options.timeoutMs);
    return { text: stdout.trim() };
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

  async transcribe(request: SttRequest, options: { timeoutMs: number }): Promise<SttAdapterResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const form = new FormData();
      const extension = request.mimeType === 'audio/wav' ? 'wav' : request.mimeType === 'audio/ogg' ? 'ogg' : request.mimeType === 'audio/mp4' ? 'm4a' : 'webm';
      form.append('file', new Blob([request.audio], { type: request.mimeType }), `audio.${extension}`);
      if (this.options.model === undefined) form.append('model', 'whisper-1');
      else if (this.options.model !== '') form.append('model', this.options.model);
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
      const contentType = response.headers.get('content-type') ?? undefined;
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new SttHttpError(response.status, contentType, safeProviderMessage(body, this.options.token));
      }
      let data: unknown;
      try { data = await response.json(); } catch {
        throw new SttJsonError(response.status, contentType);
      }
      const text = (data as { text?: unknown } | null)?.text;
      return { text: typeof text === 'string' ? text.trim() : '', httpStatus: response.status, contentType, jsonValid: true };
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
  durationMs?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
  run?: SttProcessRunner;
}

/**
 * STT orchestrator: never throws and never includes audio/token in results.
 * Errors become `skipped` with a stable reason used by the renderer for the message.
 */
export async function transcribeAudio(request: TranscribeAudioRequest): Promise<SttResult> {
  const started = Date.now();
  const baseUrl = request.baseUrl ?? (request.provider === 'cloud' ? 'https://api.openai.com/v1' : undefined);
  const common: SttDiagnostics = {
    stage: 'config',
    serviceReached: false,
    provider: request.provider,
    ...(endpointForDiagnostics(baseUrl) !== undefined ? { endpoint: endpointForDiagnostics(baseUrl) } : {}),
    ...(request.model !== undefined ? { model: request.model } : {}),
    ...(request.language !== undefined ? { language: request.language } : {}),
    audioBytes: request.audio.byteLength,
    mimeType: request.mimeType,
    ...(request.durationMs !== undefined ? { durationMs: request.durationMs } : {}),
  };
  // Every failure path returns this shape: stable reason + sanitized diagnostics, never a raw body.
  const skipped = (reason: SttSkipReason, stage: SttDiagnostics['stage'], extra: Partial<SttDiagnostics> = {}): SttResult => ({
    text: '',
    skipped: true,
    reason,
    diagnostics: { ...common, stage, serviceReached: false, elapsedMs: Date.now() - started, ...extra },
  });
  if (!isValidSttAudio(request.audio) || !isAudioMimeType(request.mimeType)) {
    return skipped('invalid-audio', 'config', { error: 'invalid audio' });
  }
  if (request.provider === 'none') {
    return skipped('unconfigured', 'config', { error: 'unconfigured' });
  }
  let adapter: SttAdapter;
  if (request.provider === 'local') {
    if (request.command === undefined || request.command.trim().length === 0) {
      return skipped('unconfigured', 'config', { error: 'unconfigured' });
    }
    if (!path.isAbsolute(request.command)) {
      return skipped('unsupported', 'unsupported', { error: 'unsupported command' });
    }
    adapter = new LocalSttAdapter(request.command, [], request.run);
  } else if (request.provider === 'cloud') {
    if (request.token === undefined || request.token.length === 0) {
      return skipped('missing-token', 'config', { error: 'missing token' });
    }
    adapter = new OpenAiSttAdapter({
      token: request.token,
      ...(request.baseUrl !== undefined ? { baseUrl: request.baseUrl } : {}),
      ...(request.model !== undefined ? { model: request.model } : {}),
      ...(request.responseFormat !== undefined ? { responseFormat: request.responseFormat } : {}),
      ...(request.fetch !== undefined ? { fetch: request.fetch } : {}),
    });
  } else {
    return skipped('unsupported', 'unsupported', { error: 'unsupported provider' });
  }
  try {
    const sttRequest: SttRequest = {
      audio: request.audio,
      mimeType: request.mimeType,
      ...(request.language !== undefined ? { language: request.language } : {}),
    };
    const result = await adapter.transcribe(sttRequest, { timeoutMs: request.timeoutMs ?? STT_DEFAULT_TIMEOUT_MS });
    const text = result.text.trim();
    const successDiagnostics: SttDiagnostics = {
      ...common,
      stage: 'success',
      serviceReached: request.provider === 'cloud',
      elapsedMs: Date.now() - started,
      textLength: text.length,
      ...(result.httpStatus !== undefined ? { httpStatus: result.httpStatus } : {}),
      ...(result.contentType !== undefined ? { contentType: result.contentType } : {}),
      ...(result.jsonValid !== undefined ? { jsonValid: result.jsonValid } : {}),
    };
    return text.length === 0
      ? { ...skipped('empty', 'empty', { ...successDiagnostics, error: 'empty transcript' }), diagnostics: { ...successDiagnostics, stage: 'empty', error: 'empty transcript' } }
      : { text, skipped: false, diagnostics: successDiagnostics };
  } catch (error) {
    const elapsedMs = Date.now() - started;
    if (isTimeoutError(error)) return skipped('timeout', 'timeout', { elapsedMs, error: 'timeout' });
    if (error instanceof SttHttpError) {
      return skipped('provider-error', 'http', {
        serviceReached: true,
        httpStatus: error.httpStatus,
        ...(error.contentType !== undefined ? { contentType: error.contentType } : {}),
        elapsedMs,
        error: `HTTP ${error.httpStatus}`,
        ...(error.providerMessage !== undefined ? { providerMessage: error.providerMessage } : {}),
      });
    }
    if (error instanceof SttJsonError) {
      return skipped('provider-error', 'json', {
        serviceReached: true,
        httpStatus: error.httpStatus,
        ...(error.contentType !== undefined ? { contentType: error.contentType } : {}),
        jsonValid: false,
        elapsedMs,
        error: 'invalid JSON',
      });
    }
    return skipped('provider-error', 'network', { elapsedMs, error: networkCategory(error) });
  }
}
