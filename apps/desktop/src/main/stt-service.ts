import type { SttStatus, SttTranscribeRequest, SttTranscribeResult } from '@smart-terminal/contracts';
import { isAudioMimeType, isValidSttAudio, transcribeAudio, type SttProcessRunner } from '@smart-terminal/ai';
import type { AppConfigStore } from './app-config';
import type { SecretStore } from './secret-store';

export interface SttServiceOptions {
  configStore: Pick<AppConfigStore, 'load'>;
  secrets: Pick<SecretStore, 'isSecure' | 'has' | 'get'>;
  fetch?: typeof fetch;
  run?: SttProcessRunner;
  timeoutMs?: number;
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

  constructor(private readonly options: SttServiceOptions) {
    this.testMode = options.testMode === true;
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
      ...(config.sttModel !== undefined ? { model: config.sttModel } : {}),
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
      return { text: STT_TEST_TEXT, skipped: false };
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
      ...(config.sttModel !== undefined ? { model: config.sttModel } : {}),
      ...((shared ? config.aiBaseUrl : config.sttBaseUrl) !== undefined ? { baseUrl: shared ? config.aiBaseUrl : config.sttBaseUrl } : {}),
      ...(config.sttResponseFormat !== undefined ? { responseFormat: config.sttResponseFormat } : {}),
      ...(config.sttLanguage !== undefined ? { language: config.sttLanguage } : {}),
      ...(this.options.timeoutMs !== undefined ? { timeoutMs: this.options.timeoutMs } : {}),
      ...(this.options.fetch !== undefined ? { fetch: this.options.fetch } : {}),
      ...(this.options.run !== undefined ? { run: this.options.run } : {}),
    });
  }

  private currentConfig() {
    const result = this.options.configStore.load();
    return result.status === 'valid' ? result.config : undefined;
  }
}
