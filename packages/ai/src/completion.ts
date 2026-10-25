import { AI_PROVIDER_INFO, type AiProvider, type CorrectionReason } from '@smart-terminal/contracts';

/** HTTP failure with a status only: never carries provider bodies or headers. */
export class ProviderHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'ProviderHttpError';
  }
}

export interface CompletionOptions {
  provider: AiProvider;
  /** Immutable system instruction; omitted for the legacy correction path. */
  system?: string;
  user: string;
  token: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface CompletionResult {
  text: string;
  skipped: boolean;
  reason?: CorrectionReason;
  /** Sanitized diagnostic (HTTP status/category only); never a token or response body. */
  error?: string;
}

function endpoint(provider: AiProvider, baseUrl?: string): string {
  const info = AI_PROVIDER_INFO[provider];
  const base = (baseUrl || info.baseUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('provider-error');
  return info.protocol === 'anthropic' ? `${base}/v1/messages` : `${base}/chat/completions`;
}

/** One provider completion with optional system instruction; neither body nor token leaks out. */
export async function requestCompletion(options: CompletionOptions): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const call = options.fetch ?? fetch;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    let body: unknown;
    if (AI_PROVIDER_INFO[options.provider].protocol === 'anthropic') {
      headers['x-api-key'] = options.token;
      headers['anthropic-version'] = '2023-06-01';
      body = {
        model: options.model || 'claude-3-5-haiku-latest',
        max_tokens: 2048,
        ...(options.system !== undefined && options.system.length > 0 ? { system: options.system } : {}),
        messages: [{ role: 'user', content: options.user }],
      };
    } else {
      headers['authorization'] = `Bearer ${options.token}`;
      body = {
        model: options.model || 'gpt-4o-mini',
        temperature: 0,
        messages: [
          ...(options.system !== undefined && options.system.length > 0 ? [{ role: 'system', content: options.system }] : []),
          { role: 'user', content: options.user },
        ],
      };
    }
    const response = await call(endpoint(options.provider, options.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new ProviderHttpError(response.status);
    const data: unknown = await response.json();
    if (AI_PROVIDER_INFO[options.provider].protocol === 'anthropic') {
      const content = (data as { content?: { text?: unknown }[] }).content;
      return content?.map((part) => (typeof part.text === 'string' ? part.text : '')).join('').trim() ?? '';
    }
    const choices = (data as { choices?: { message?: { content?: unknown } }[] }).choices;
    return typeof choices?.[0]?.message?.content === 'string' ? choices[0].message.content.trim() : '';
  } finally {
    clearTimeout(timer);
  }
}

/** Validates config/token, runs one completion and maps failures to stable, sanitized reasons. */
export async function completeText(options: CompletionOptions): Promise<CompletionResult> {
  const skip = (reason: CorrectionReason, error?: string): CompletionResult => ({ text: '', skipped: true, reason, ...(error !== undefined ? { error } : {}) });
  if (!options.provider || options.provider === 'none') return skip('unconfigured');
  if (!options.token) return skip('missing-token');
  if (options.provider === 'openai-compatible' && !options.baseUrl) return skip('unconfigured');
  try {
    const text = await requestCompletion(options);
    if (!text.trim()) return skip('empty');
    return { text: text.trim(), skipped: false };
  } catch (error) {
    const reason: CorrectionReason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'provider-error';
    return skip(reason, error instanceof ProviderHttpError ? error.message : 'Provider request failed.');
  }
}
