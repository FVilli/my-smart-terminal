import type {

  AiActionRequest,
  AiActionResult,
  AiComposeRequest,
  AiComposeResult,
  AiCorrectRequest,
  AiModelInfo,
  AiModelsRequest,
  AiStatus,
  CorrectionResult,
  SetupTestAiRequest,
  SetupTestAiResult,
} from '@smart-terminal/contracts';
import { DEFAULT_AI_ACTIONS, composeAction, correctText, isShellCommand, listAiModels, runAiAction } from '@smart-terminal/ai';
import type { AiActionsStore } from './ai-actions-store';
import { isSensitiveText } from '@smart-terminal/data';
import type { AppConfigStore } from './app-config';
import type { SecretStore } from './secret-store';

export const AI_CLIPBOARD_MAX_CHARS = 16000;
const AI_CLIPBOARD_TRUNCATION_MARKER = '\n[truncated]';

export interface AiServiceOptions {
  configStore: Pick<AppConfigStore, 'load'>;
  aiActions: Pick<AiActionsStore, 'list'>;
  secrets: Pick<SecretStore, 'isSecure' | 'has' | 'get'>;
  clipboard?: { readText(): string | Promise<string> };
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** AI action timeout (modal); defaults to 15 s. */
  actionTimeoutMs?: number;
  /** Test seam: deterministic response, no network. Active only with SMART_TERMINAL_AI_TEST_MODE=1. */
  testMode?: boolean;
}

const TEST_CORRECTION = (text: string): string => text.replace(/\bsentance\b/g, 'sentence');

/** Deterministic answers for smoke tests only (SMART_TERMINAL_AI_TEST_MODE=1). */
const TEST_ACTIONS: Record<string, string> = {
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

  /** Lists provider models on demand; entered token wins over the stored one. */
  async models(request?: AiModelsRequest): Promise<AiModelInfo[]> {
    const config = request?.config ?? this.currentConfig();
    if (config === undefined || config.aiProvider === 'none') return [];
    if (this.testMode) return [{ id: 'gpt-test' }, { id: 'model-large' }];
    const entered = request?.aiToken?.trim();
    const token = entered !== undefined && entered.length > 0 ? entered : this.options.secrets.get(`ai:${config.aiProvider}`);
    if (token === undefined) throw new Error('AI token is not configured.');
    return listAiModels({
      provider: config.aiProvider,
      token,
      timeoutMs: this.timeoutMs,
      ...(config.aiBaseUrl !== undefined ? { baseUrl: config.aiBaseUrl } : {}),
      ...(this.fetchFn !== undefined ? { fetch: this.fetchFn } : {}),
    });
  }

  /** Renders the editable prompt body; clipboard is read here, never persisted. */
  async compose(request: AiComposeRequest): Promise<AiComposeResult> {
    const definition = this.options.aiActions.list().actions.find((item) => item.id === request.actionId) ?? DEFAULT_AI_ACTIONS.find((item) => item.id === request.actionId);
    if (definition === undefined) throw new Error('AI_ACTION_UNKNOWN');
    const environment = request.environment;
    let clipboardValue: unknown = '';
    try { clipboardValue = await this.options.clipboard?.readText(); } catch { /* clipboard may be unavailable; compose must still work */ }
    const rawClipboard = typeof clipboardValue === 'string' ? clipboardValue : '';
    const clipboardText = rawClipboard.replace(/[\0\r]/g, '');
    const clipboard = clipboardText.length > AI_CLIPBOARD_MAX_CHARS
      ? `${clipboardText.slice(0, AI_CLIPBOARD_MAX_CHARS)}${AI_CLIPBOARD_TRUNCATION_MARKER}`
      : clipboardText;
    return composeAction(definition, {
      action: definition.title,
      intent: definition.description,
      description: definition.description,
      composer: request.composerText,
      console: request.consoleText,
      clipboard,
      terminalInfo: request.terminalInfo,
      os: environment?.os ?? 'unknown',
      shell: environment?.shell ?? 'unknown',
      envSource: environment?.source ?? 'unknown',
    });
  }

  /** Runs one modal action; provider bodies and tokens never leave this process. */
  async action(request: AiActionRequest): Promise<AiActionResult> {
    const started = Date.now();
    const elapsed = (): number => Date.now() - started;
    const config = this.currentConfig();
    if (config === undefined || config.aiProvider === 'none') {
      return { text: '', skipped: true, reason: 'unconfigured', elapsedMs: elapsed() };
    }
    // Authoritative secret gate: blocks the provider call before any network access, and before
    // test mode, so the UI path can be exercised with the same rule.
    if (isSensitiveText(request.system) || isSensitiveText(request.user)) {
      return { text: '', skipped: true, reason: 'sensitive', elapsedMs: elapsed() };
    }
    if (this.testMode) {
      return { text: TEST_ACTIONS[request.actionId] ?? 'Test answer.', skipped: false, elapsedMs: elapsed() }; 
    }
    const token = this.options.secrets.get(`ai:${config.aiProvider}`);
    if (token === undefined) {
      return { text: '', skipped: true, reason: 'missing-token', elapsedMs: elapsed() };
    }
    return runAiAction({
      actionId: request.actionId,
      system: request.system,
      user: request.user,
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
