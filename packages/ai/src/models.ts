import { AI_PROVIDER_INFO, type AiProvider, type AiModelInfo } from '@smart-terminal/contracts';

/** Heuristic: identifiers that look like speech-to-text/audio models; a chat model with such a name could be filtered too. */
export function isSpeechToTextModelId(id: string): boolean {
  const value = id.toLowerCase();
  if (/(tts|text-to-speech|embedding|image|vision)/.test(value)) return false;
  return /(whisper|transcri|asr|speech|audio|parakeet|voxtral)/.test(value);
}

export interface ListAiModelsOptions {
  provider: AiProvider;
  baseUrl?: string;
  token: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export async function listAiModels(options: ListAiModelsOptions): Promise<AiModelInfo[]> {
  const info = AI_PROVIDER_INFO[options.provider];
  if (info.protocol === 'none') throw new Error('AI provider is not configured.');
  const base = (options.baseUrl || info.baseUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('AI base URL is required.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const headers: Record<string, string> = info.protocol === 'anthropic'
      ? { 'x-api-key': options.token, 'anthropic-version': '2023-06-01' }
      : { authorization: `Bearer ${options.token}` };
    const response = await (options.fetch ?? fetch)(`${base}${info.protocol === 'anthropic' ? '/v1/models' : '/models'}`, { method: 'GET', headers, signal: controller.signal });
    if (!response.ok) throw new Error(`AI model request failed: HTTP ${response.status}`);
    const payload: unknown = await response.json();
    const data = (payload as { data?: unknown }).data;
    if (!Array.isArray(data)) return [];
    return [...new Set(data.flatMap((item) => item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' ? [(item as { id: string }).id] : []))]
      .filter((id) => !isSpeechToTextModelId(id))
      .sort()
      .map((id) => ({ id }));
  } finally { clearTimeout(timer); }
}
