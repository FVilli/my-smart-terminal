import type {
  AiActionId,
  AiActionResult,
  AiComposeRequest,
  AiComposeResult,
  AiCorrectRequest,
  AiStatus,
  CorrectionResult,
  SetupTestAiRequest,
  SetupTestAiResult,
} from '@smart-terminal/contracts';
import { buildActionBody, correctText, isShellCommand, runAiAction } from '@smart-terminal/ai';
import type { AppConfigStore } from './app-config';
import type { SecretStore } from './secret-store';

export interface AiServiceOptions {
  configStore: Pick<AppConfigStore, 'load'>;
  secrets: Pick<SecretStore, 'isSecure' | 'has' | 'get'>;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** AI action timeout (modal); defaults to 15 s. */
  actionTimeoutMs?: number;
  /** Test seam: deterministic response, no network. Active only with SMART_TERMINAL_AI_TEST_MODE=1. */
  testMode?: boolean;
}

const TEST_CORRECTION = (text: string): string => text.replace(/\bsentance\b/g, 'sentence');

/** Deterministic answers for smoke tests only (SMART_TERMINAL_AI_TEST_MODE=1). */
const TEST_ACTIONS: Record<AiActionId, string> = {
  'suggest-command': 'echo ok',
  'explain-command': 'Prints "ok" to the terminal.',
  'assess-risk': 'Risk: low\nWhy: prints text only.\nReversible: yes\nPrivileges: none\nSafer alternative: none',
  'fix-message': 'Fixed message.',
  'rewrite-dictated': 'Rewritten message.',
};

/**
 * Main-process AI correction: config and tokens never cross the IPC boundary.
 * Falls back to the original on a missing provider/token, timeout, or error.
 */
export class AiService {
  private readonly fetchFn: typeof fetch | undefined;
  private readonly timeoutMs: number;
  private readonly actionTimeoutMs: number;
  private readonly testMode: boolean;

  constructor(private readonly options: AiServiceOptions) {
    this.fetchFn = options.fetch;
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.actionTimeoutMs = options.actionTimeoutMs ?? 15000;
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
        ...(this.testMode ? { warning: 'AI test mode active.' } : {}),
      };
    }
    const hasToken = this.testMode || this.options.secrets.has(`ai:${config.aiProvider}`);
    return {
      configured: hasToken,
      provider: config.aiProvider,
      ...(config.aiModel !== undefined ? { model: config.aiModel } : {}),
      hasToken,
      secureStorage: this.options.secrets.isSecure(),
      ...(!hasToken ? { warning: 'AI token not configured.' } : this.testMode ? { warning: 'AI test mode active.' } : {}),
    };
  }

  async testConnection(request?: SetupTestAiRequest): Promise<SetupTestAiResult> {
    const config = request?.config ?? this.currentConfig();
    if (config === undefined || config.aiProvider === 'none') {
      return { ok: false, provider: 'none', error: 'AI provider is not configured.' };
    }
    if (this.testMode) {
      return { ok: true, provider: config.aiProvider, latencyMs: 0, response: 'OK', ...(config.aiModel !== undefined ? { model: config.aiModel } : {}) };
    }
    const entered = request?.aiToken?.trim();
    const token = entered !== undefined && entered.length > 0 ? entered : this.options.secrets.get(`ai:${config.aiProvider}`);
    if (token === undefined) {
      return { ok: false, provider: config.aiProvider, error: 'AI token is not configured.' };
    }
    const started = Date.now();
    const result = await correctText({
      provider: config.aiProvider,
      text: 'This is a sentance with a typo',
      token,
      ...(config.aiBaseUrl !== undefined ? { baseUrl: config.aiBaseUrl } : {}),
      ...(config.aiModel !== undefined ? { model: config.aiModel } : {}),
      timeoutMs: this.timeoutMs,
      ...(this.fetchFn !== undefined ? { fetch: this.fetchFn } : {}),
    });
    if (result.skipped) {
      return {
        ok: false,
        provider: config.aiProvider,
        error: result.reason === 'timeout' ? 'AI request timed out.' : result.error ?? 'AI provider did not respond successfully.',
      };
    }
    return {
      ok: true,
      provider: config.aiProvider,
      latencyMs: Date.now() - started,
      response: result.corrected.slice(0, 120),
      ...(config.aiModel !== undefined ? { model: config.aiModel } : {}),
    };
  }

  /** Renders the editable prompt body; no network and no token access. */
  compose(request: AiComposeRequest): AiComposeResult {
    return { prompt: buildActionBody(request) };
  }

  /** Runs one modal action; provider bodies and tokens never leave this process. */
  async action(request: { action: AiActionId; prompt: string }): Promise<AiActionResult> {
    const started = Date.now();
    const elapsed = (): number => Date.now() - started;
    const config = this.currentConfig();
    if (config === undefined || config.aiProvider === 'none') {
      return { text: '', skipped: true, reason: 'unconfigured', elapsedMs: elapsed() };
    }
    if (this.testMode) {
      return { text: TEST_ACTIONS[request.action], skipped: false, elapsedMs: elapsed() };
    }
    const token = this.options.secrets.get(`ai:${config.aiProvider}`);
    if (token === undefined) {
      return { text: '', skipped: true, reason: 'missing-token', elapsedMs: elapsed() };
    }
    return runAiAction({
      action: request.action,
      prompt: request.prompt,
      provider: config.aiProvider,
      token,
      ...(config.aiBaseUrl !== undefined ? { baseUrl: config.aiBaseUrl } : {}),
      ...(config.aiModel !== undefined ? { model: config.aiModel } : {}),
      timeoutMs: this.actionTimeoutMs,
      ...(this.fetchFn !== undefined ? { fetch: this.fetchFn } : {}),
    });
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
