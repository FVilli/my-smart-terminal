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
  /** Seam di test: trascrizione deterministica, nessun adapter/rete/file. Attivo solo con SMART_TERMINAL_STT_TEST_MODE=1. */
  testMode?: boolean;
}

export const STT_TEST_TEXT = 'testo dettato di prova';

const CLOUD_TOKEN_KEY = 'stt:cloud';

const skipped = (reason: NonNullable<SttTranscribeResult['reason']>): SttTranscribeResult => ({
  text: '',
  skipped: true,
  reason,
});

/**
 * STT lato main: config e token non attraversano mai il confine IPC e l'audio vive solo in memoria.
 * Non lancia mai: ogni errore diventa un risultato `skipped` con motivo stabile.
 */
export class SttService {
  private readonly testMode: boolean;

  constructor(private readonly options: SttServiceOptions) {
    this.testMode = options.testMode === true;
  }

  status(): SttStatus {
    const config = this.currentConfig();
    const secureStorage = this.options.secrets.isSecure();
    const testWarning = 'Modalità test STT attiva.';
    if (config === undefined || config.sttProvider === 'none') {
      return {
        configured: false,
        provider: 'none',
        hasToken: false,
        secureStorage,
        ...(this.testMode ? { warning: testWarning } : {}),
      };
    }
    const hasToken = this.options.secrets.has(CLOUD_TOKEN_KEY);
    const hasCommand = config.sttCommand !== undefined;
    const configured = this.testMode || (config.sttProvider === 'cloud' ? hasToken : hasCommand);
    const warning = configured
      ? this.testMode
        ? testWarning
        : undefined
      : config.sttProvider === 'cloud'
        ? 'Token STT non configurato.'
        : 'Comando STT locale non configurato.';
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
    const token = config.sttProvider === 'cloud' ? this.options.secrets.get(CLOUD_TOKEN_KEY) : undefined;
    return transcribeAudio({
      provider: config.sttProvider,
      audio,
      mimeType,
      ...(token !== undefined ? { token } : {}),
      ...(config.sttProvider === 'local' && config.sttCommand !== undefined ? { command: config.sttCommand } : {}),
      ...(config.sttModel !== undefined ? { model: config.sttModel } : {}),
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
