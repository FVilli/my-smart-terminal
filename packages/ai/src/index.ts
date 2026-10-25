import type { AiProvider } from '@smart-terminal/contracts';
import { ProviderHttpError, requestCompletion } from './completion';
export type { AiProvider } from '@smart-terminal/contracts';
export {
  LocalSttAdapter,
  OpenAiSttAdapter,
  STT_DEFAULT_TIMEOUT_MS,
  execFileSttRunner,
  isAudioMimeType,
  isValidSttAudio,
  transcribeAudio,
  type OpenAiSttOptions,
  type SttAdapter,
  type SttProcessRunner,
  type SttRequest,
  type SttResult,
  type TranscribeAudioRequest,
} from './stt';

/** Input for one correction: provider, text, and optional endpoint/model/token overrides. */
export interface CorrectionRequest {
  provider: AiProvider;
  text: string;
  token?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

/** Outcome of a correction: text, whether it changed, or why it was skipped (sanitized `error`). */
export interface CorrectionResult {
  original: string;
  corrected: string;
  changed: boolean;
  skipped: boolean;
  reason?: 'shell' | 'unconfigured' | 'missing-token' | 'timeout' | 'provider-error' | 'empty';
  /** Sanitized diagnostic (HTTP status/category only); never a token or response body. */
  error?: string;
}

/** Provider adapter contract: return corrected text or throw a sanitized provider error. */
export interface AiProviderAdapter {
  correct(input: string, options: { token: string; baseUrl?: string; model?: string; timeoutMs?: number; fetch?: typeof fetch }): Promise<string>;
}

/** Checks whether text appears to be a shell command. */
export function isShellCommand(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  // Shell operators or a line start that is clearly a command/executable.
  const startsAsCommand =
    /^(?:sudo\s+)?(?:\.{1,2}\/|\/|~\/)/.test(value) ||
    /^(?:sudo\s+)?(?:cd|ls|pwd|cat|grep|find|awk|sed|ssh|scp|git|npm|npx|node|python\w*|bash|sh|chmod|mkdir|rm|cp|mv|docker|curl|wget|make|tar|exit|export)(?:\s|$)/i.test(value) ||
    /^(?:sudo\s+)?[A-Za-z0-9._-]+\s+-{1,2}[\w-]+/.test(value);
  return /(?:\|\||&&|\$\(|`)/.test(value) || /[;<>]/.test(value) || startsAsCommand;
}

/** Builds the instruction prompt used for text correction. */
export function buildCorrectionPrompt(text: string): string {
  return `Correct only the typos in the text. Preserve code, paths, URLs, commands, flags, file names, and meaning exactly. Reply only with the corrected text, without explanations or additions.\n\n--- BEGIN TEXT ---\n${text}\n--- END TEXT ---`;
}

/** Adapter for text correction through Anthropic. */
export const anthropicAdapter: AiProviderAdapter = { correct: (input, options) => requestCompletion({ ...options, provider: 'anthropic', user: buildCorrectionPrompt(input) }) };
/** Adapter for text correction through OpenAI. */
export const openAiAdapter: AiProviderAdapter = { correct: (input, options) => requestCompletion({ ...options, provider: 'openai', user: buildCorrectionPrompt(input) }) };
/** Adapter for text correction through an OpenAI-compatible endpoint. */
export const openAiCompatibleAdapter: AiProviderAdapter = { correct: (input, options) => requestCompletion({ ...options, provider: 'openai-compatible', user: buildCorrectionPrompt(input) }) };

export async function correctText(requestData: CorrectionRequest): Promise<CorrectionResult> {
  const original = requestData.text;
  const skip = (reason: CorrectionResult['reason']): CorrectionResult => ({ original, corrected: original, changed: false, skipped: true, reason });
  if (isShellCommand(original)) return skip('shell');
  if (!requestData.provider || requestData.provider === 'none') return skip('unconfigured');
  if (!requestData.token) return skip('missing-token');
  if (requestData.provider === 'openai-compatible' && !requestData.baseUrl) return skip('unconfigured');
  try {
    const adapter = requestData.provider === 'anthropic' ? anthropicAdapter : requestData.provider === 'openai' ? openAiAdapter : openAiCompatibleAdapter;
    const corrected = await adapter.correct(original, { token: requestData.token, baseUrl: requestData.baseUrl, model: requestData.model, timeoutMs: requestData.timeoutMs, fetch: requestData.fetch });
    if (!corrected.trim()) return skip('empty');
    return { original, corrected, changed: corrected !== original, skipped: false };
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'provider-error';
    const diagnostic = error instanceof ProviderHttpError ? error.message : 'Provider request failed.';
    return { ...skip(reason), error: diagnostic };
  }
}

export { completeText, ProviderHttpError, type CompletionOptions, type CompletionResult } from './completion';
export * from './actions';
export * from './action-templates';
export * from './placeholders';
