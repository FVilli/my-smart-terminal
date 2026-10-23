import type { AiProvider } from '@smart-terminal/contracts';
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

export interface CorrectionRequest {
  provider: AiProvider;
  text: string;
  token?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface CorrectionResult {
  original: string;
  corrected: string;
  changed: boolean;
  skipped: boolean;
  reason?: 'shell' | 'unconfigured' | 'missing-token' | 'timeout' | 'provider-error' | 'empty';
}

export interface AiProviderAdapter {
  correct(input: string, options: { token: string; baseUrl?: string; model?: string; timeoutMs?: number; fetch?: typeof fetch }): Promise<string>;
}

export function isShellCommand(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  // Operatori di shell o inizio riga che è chiaramente un comando/eseguibile.
  const startsAsCommand =
    /^(?:sudo\s+)?(?:\.{1,2}\/|\/|~\/)/.test(value) ||
    /^(?:sudo\s+)?(?:cd|ls|pwd|cat|grep|find|awk|sed|ssh|scp|git|npm|npx|node|python\w*|bash|sh|chmod|mkdir|rm|cp|mv|docker|curl|wget|make|tar|exit|export)(?:\s|$)/i.test(value) ||
    /^(?:sudo\s+)?[A-Za-z0-9._-]+\s+-{1,2}[\w-]+/.test(value);
  return /(?:\|\||&&|\$\(|`)/.test(value) || /[;<>]/.test(value) || startsAsCommand;
}

export function buildCorrectionPrompt(text: string): string {
  return `Correggi esclusivamente i refusi nel testo. Preserva esattamente codice, path, URL, comandi, flag, nomi di file e significato. Rispondi solo con il testo corretto, senza spiegazioni o aggiunte.\n\n--- INIZIO TESTO ---\n${text}\n--- FINE TESTO ---`;
}

function endpoint(provider: AiProvider, baseUrl?: string): string {
  const base = (baseUrl || (provider === 'anthropic' ? 'https://api.anthropic.com' : provider === 'openai' ? 'https://api.openai.com/v1' : '')).replace(/\/$/, '');
  if (!base) throw new Error('provider-error');
  return provider === 'anthropic' ? `${base}/v1/messages` : `${base}/chat/completions`;
}

async function request(provider: AiProvider, input: string, options: Parameters<AiProviderAdapter['correct']>[1]): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const call = options.fetch ?? fetch;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    let body: unknown;
    if (provider === 'anthropic') {
      headers['x-api-key'] = options.token;
      headers['anthropic-version'] = '2023-06-01';
      body = { model: options.model || 'claude-3-5-haiku-latest', max_tokens: 2048, messages: [{ role: 'user', content: buildCorrectionPrompt(input) }] };
    } else {
      headers['authorization'] = `Bearer ${options.token}`;
      body = { model: options.model || 'gpt-4o-mini', temperature: 0, messages: [{ role: 'user', content: buildCorrectionPrompt(input) }] };
    }
    const response = await call(endpoint(provider, options.baseUrl), { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) throw new Error('provider-error');
    const data: unknown = await response.json();
    if (provider === 'anthropic') {
      const content = (data as { content?: { text?: unknown }[] }).content;
      return content?.map((part) => typeof part.text === 'string' ? part.text : '').join('').trim() ?? '';
    }
    const choices = (data as { choices?: { message?: { content?: unknown } }[] }).choices;
    return typeof choices?.[0]?.message?.content === 'string' ? choices[0].message.content.trim() : '';
  } finally { clearTimeout(timer); }
}

export const anthropicAdapter: AiProviderAdapter = { correct: (input, options) => request('anthropic', input, options) };
export const openAiAdapter: AiProviderAdapter = { correct: (input, options) => request('openai', input, options) };
export const openAiCompatibleAdapter: AiProviderAdapter = { correct: (input, options) => request('openai-compatible', input, options) };

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
    return skip(error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'provider-error');
  }
}
