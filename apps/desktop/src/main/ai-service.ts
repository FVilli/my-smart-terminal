import type {
  AiCorrectRequest,
  AiStatus,
  CorrectionResult,
} from '@smart-terminal/contracts';
import { correctText, isShellCommand } from '@smart-terminal/ai';
import type { AppConfigStore } from './app-config';
import type { SecretStore } from './secret-store';

export interface AiServiceOptions {
  configStore: Pick<AppConfigStore, 'load'>;
  secrets: Pick<SecretStore, 'isSecure' | 'has' | 'get'>;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Seam di test: risposta deterministica, nessuna rete. Attivo solo con SMART_TERMINAL_AI_TEST_MODE=1. */
  testMode?: boolean;
}

const TEST_CORRECTION = (text: string): string => text.replace(/\bQuesto e\b/g, 'Questo è').replace(/\bquesto e\b/g, 'questo è');

/**
 * Correzione AI lato main: config e token non attraversano mai il confine IPC.
 * Fallback all'originale su provider assente, token mancante, timeout o errore.
 */
export class AiService {
  private readonly fetchFn: typeof fetch | undefined;
  private readonly timeoutMs: number;
  private readonly testMode: boolean;

  constructor(private readonly options: AiServiceOptions) {
    this.fetchFn = options.fetch;
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.testMode = options.testMode === true;
  }

  status(): AiStatus {
    const config = this.currentConfig();
    if (config === undefined || config.aiProvider === 'none') {
      return {
        configured: false,
        provider: 'none',
        hasToken: false,
        secureStorage: this.options.secrets.isSecure(),
        ...(this.testMode ? { warning: 'Modalità test AI attiva.' } : {}),
      };
    }
    const hasToken = this.testMode || this.options.secrets.has(`ai:${config.aiProvider}`);
    return {
      configured: hasToken,
      provider: config.aiProvider,
      ...(config.aiModel !== undefined ? { model: config.aiModel } : {}),
      hasToken,
      secureStorage: this.options.secrets.isSecure(),
      ...(!hasToken ? { warning: 'Token AI non configurato.' } : this.testMode ? { warning: 'Modalità test AI attiva.' } : {}),
    };
  }

  async correct(request: AiCorrectRequest): Promise<CorrectionResult> {
    const original = request.text;
    const config = this.currentConfig();
    if (config === undefined || config.aiProvider === 'none') {
      return skipped(original, 'unconfigured');
    }
    if (isShellCommand(original)) {
      return skipped(original, 'shell');
    }
    if (this.testMode) {
      const corrected = TEST_CORRECTION(original);
      return corrected === original
        ? skipped(original, 'empty')
        : { original, corrected, changed: true, skipped: false };
    }
    const token = this.options.secrets.get(`ai:${config.aiProvider}`);
    if (token === undefined) {
      return skipped(original, 'missing-token');
    }
    return correctText({
      provider: config.aiProvider,
      text: original,
      token,
      ...(config.aiBaseUrl !== undefined ? { baseUrl: config.aiBaseUrl } : {}),
      ...(config.aiModel !== undefined ? { model: config.aiModel } : {}),
      timeoutMs: this.timeoutMs,
      ...(this.fetchFn !== undefined ? { fetch: this.fetchFn } : {}),
    });
  }

  private currentConfig() {
    const result = this.options.configStore.load();
    return result.status === 'valid' ? result.config : undefined;
  }
}

function skipped(original: string, reason: NonNullable<CorrectionResult['reason']>): CorrectionResult {
  return { original, corrected: original, changed: false, skipped: true, reason };
}
