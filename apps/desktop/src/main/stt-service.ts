import fs from 'node:fs';
import path from 'node:path';
import { AI_PROVIDER_INFO, type SttModelInfo, type SttModelsRequest, type SttSaveDebugAudioRequest, type SttSaveDebugAudioResult, type SttStatus, type SttTranscribeRequest, type SttTranscribeResult } from '@smart-terminal/contracts';
import { isAudioMimeType, isSpeechToTextModelId, isValidSttAudio, transcribeAudio, type SttProcessRunner } from '@smart-terminal/ai';
import type { AppConfigStore } from './app-config';
import type { SecretStore } from './secret-store';

export interface SttServiceOptions {
  configStore: Pick<AppConfigStore, 'load'>;
  secrets: Pick<SecretStore, 'isSecure' | 'has' | 'get'>;
  fetch?: typeof fetch;
  run?: SttProcessRunner;
  timeoutMs?: number;
  /** Debug-only directory for explicit STT test audio; never used by normal dictation. */
  debugDirectory?: string;
  /** Test seam: deterministic transcription, no adapter/network/file. Active only with SMART_TERMINAL_STT_TEST_MODE=1. */
  testMode?: boolean;
}

export const STT_TEST_TEXT = 'test transcript';

const CLOUD_TOKEN_KEY = 'stt:cloud';
const aiTokenKey = (provider: string): string => `ai:${provider}`;

const skipped = (reason: NonNullable<SttTranscribeResult['reason']>): SttTranscribeResult => ({
  text: '',
  skipped: true,
  reason,
});

/**
 * Main-process STT: config and tokens never cross the IPC boundary and audio lives only in memory.
 * Never throws: every error becomes a `skipped` result with a stable reason.
 */
export class SttService {
  private readonly testMode: boolean;
  private readonly debugDirectory: string | undefined;

  constructor(private readonly options: SttServiceOptions) {
    this.testMode = options.testMode === true;
    this.debugDirectory = options.debugDirectory;
  }

  async models(request?: SttModelsRequest): Promise<SttModelInfo[]> {
    if (this.testMode) return [{ id: 'qwen3-asr-0.6b', loaded: true }, { id: 'qwen3-asr-1.7b', loaded: false }];
    const config = request?.config ?? this.currentConfig();
    if (config === undefined || config.sttProvider !== 'cloud') return [];
    const shared = config.sttUseAiProvider === true;
    if (shared && config.aiProvider !== 'openai' && config.aiProvider !== 'openai-compatible') return [];
    const tokenKey = shared ? aiTokenKey(config.aiProvider) : CLOUD_TOKEN_KEY;
    const entered = request?.sttToken?.trim();
    const token = entered !== undefined && entered.length > 0 ? entered : this.options.secrets.get(tokenKey);
    if (token === undefined) throw new Error('STT token is not configured.');
    const baseUrl = this.cloudBaseUrl(config).replace(/\/$/, '');
    const call = this.options.fetch ?? fetch;
    const response = await call(`${baseUrl}/models`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: unknown = await response.json();
    const entries = Array.isArray((data as { data?: unknown }).data) ? (data as { data: unknown[] }).data : [];
    return entries.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return [];
      const item = entry as { id?: unknown; audio_workflows?: unknown; loaded?: unknown; is_loaded?: unknown; status?: unknown };
      if (typeof item.id !== 'string') return [];
      const workflows = Array.isArray(item.audio_workflows) ? item.audio_workflows : [];
      if (workflows.length > 0 && !workflows.some((workflow) => workflow === 'transcribe')) return [];
      // Providers without workflow metadata (OpenAI-compatible): keep only audio/transcription ids.
      if (workflows.length === 0 && !isSpeechToTextModelId(item.id)) return [];
      const loaded = item.loaded === true || item.is_loaded === true || item.status === 'loaded';
      return [{ id: item.id, loaded }];
    });
  }

  saveDebugAudio(request: SttSaveDebugAudioRequest): SttSaveDebugAudioResult {
    if (this.debugDirectory === undefined) throw new Error('STT debug directory is unavailable');
    if (!isValidSttAudio(request.audio) || !isAudioMimeType(request.mimeType)) throw new Error('Invalid debug audio');
    const extension = request.mimeType === 'audio/wav' ? '.wav' : request.mimeType === 'audio/ogg' ? '.ogg' : '.webm';
    fs.mkdirSync(this.debugDirectory, { recursive: true, mode: 0o700 });
    const target = path.join(this.debugDirectory, `stt-${new Date().toISOString().replace(/[:.]/g, '-')}${extension}`);
    fs.writeFileSync(target, request.audio, { mode: 0o600 });
    return { path: target, bytes: request.audio.byteLength };
  }

  status(): SttStatus {
    const config = this.currentConfig();
    const secureStorage = this.options.secrets.isSecure();
    const testWarning = 'STT test mode active.';
    if (config === undefined || config.sttProvider === 'none') {
      return {
        configured: false,
        provider: 'none',
        hasToken: false,
        secureStorage,
        ...(this.testMode ? { warning: testWarning } : {}),
      };
    }
    const shared = config.sttProvider === 'cloud' && config.sttUseAiProvider === true;
    const supportedSharedProvider = config.aiProvider === 'openai' || config.aiProvider === 'openai-compatible';
    if (shared && !supportedSharedProvider) {
      return { configured: false, provider: config.sttProvider, ...(config.sttModel !== undefined ? { model: config.sttModel } : {}), hasToken: false, secureStorage, warning: 'Use same AI provider requires an OpenAI-compatible AI provider.' };
    }
    const hasToken = config.sttProvider === 'cloud'
      ? this.options.secrets.has(shared ? aiTokenKey(config.aiProvider) : CLOUD_TOKEN_KEY)
      : false;
    const hasCommand = config.sttCommand !== undefined;
    const configured = this.testMode || (config.sttProvider === 'cloud' ? hasToken : hasCommand);
    const warning = configured
      ? this.testMode
        ? testWarning
        : undefined
      : config.sttProvider === 'cloud'
        ? 'STT token not configured.'
        : 'Local STT command not configured.';
    return {
      configured,
      provider: config.sttProvider,
      ...(config.sttProvider === 'cloud' ? { model: config.sttModel ?? '' } : config.sttModel !== undefined ? { model: config.sttModel } : {}),
      hasToken,
      secureStorage,
      ...(warning !== undefined ? { warning } : {}),
    };
  }

  async transcribe(request: SttTranscribeRequest): Promise<SttTranscribeResult> {
    const audio = (request as { audio?: unknown }).audio;
    const mimeType = (request as { mimeType?: unknown }).mimeType;
    if (!isValidSttAudio(audio) || !isAudioMimeType(mimeType)) {
      return skipped('invalid-audio');
    }
    if (this.testMode) {
      const diagnostics = { stage: 'test' as const, serviceReached: false, elapsedMs: 0, audioBytes: audio.byteLength, mimeType, ...(request.durationMs !== undefined ? { durationMs: request.durationMs } : {}) };
      return { text: STT_TEST_TEXT, skipped: false, diagnostics };
    }
    const config = this.currentConfig();
    if (config === undefined || config.sttProvider === 'none') {
      return skipped('unconfigured');
    }
    const shared = config.sttProvider === 'cloud' && config.sttUseAiProvider === true;
    if (shared && config.aiProvider !== 'openai' && config.aiProvider !== 'openai-compatible') return skipped('unconfigured');
    const tokenKey = shared ? aiTokenKey(config.aiProvider) : CLOUD_TOKEN_KEY;
    const token = config.sttProvider === 'cloud' ? this.options.secrets.get(tokenKey) : undefined;
    return transcribeAudio({
      provider: config.sttProvider,
      audio,
      mimeType,
      ...(token !== undefined ? { token } : {}),
      ...(config.sttProvider === 'local' && config.sttCommand !== undefined ? { command: config.sttCommand } : {}),
      ...(config.sttProvider === 'cloud' ? { model: config.sttModel ?? '' } : config.sttModel !== undefined ? { model: config.sttModel } : {}),
      ...(config.sttProvider === 'cloud' ? { baseUrl: this.cloudBaseUrl(config) } : {}),
      ...(config.sttResponseFormat !== undefined ? { responseFormat: config.sttResponseFormat } : {}),
      ...(config.sttLanguage !== undefined ? { language: config.sttLanguage } : {}),
      ...(request.durationMs !== undefined ? { durationMs: request.durationMs } : {}),
      ...(this.options.timeoutMs !== undefined ? { timeoutMs: this.options.timeoutMs } : {}),
      ...(this.options.fetch !== undefined ? { fetch: this.options.fetch } : {}),
      ...(this.options.run !== undefined ? { run: this.options.run } : {}),
    });
  }

  private cloudBaseUrl(config: { sttUseAiProvider?: boolean; aiBaseUrl?: string; sttBaseUrl?: string; sttApiProvider?: string; aiProvider?: string }): string {
    if (config.sttUseAiProvider === true) {
      return config.aiBaseUrl ?? (config.aiProvider !== undefined ? AI_PROVIDER_INFO[config.aiProvider as keyof typeof AI_PROVIDER_INFO]?.baseUrl : undefined) ?? 'https://api.openai.com/v1';
    }
    return config.sttBaseUrl ?? (config.sttApiProvider !== undefined ? AI_PROVIDER_INFO[config.sttApiProvider as keyof typeof AI_PROVIDER_INFO]?.baseUrl : undefined) ?? 'https://api.openai.com/v1';
  }

  private currentConfig() {
    const result = this.options.configStore.load();
    return result.status === 'valid' ? result.config : undefined;
  }
}
