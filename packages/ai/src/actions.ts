import type { AiActionDefinition, AiActionResult, AiProvider, CorrectionReason } from '@smart-terminal/contracts';
import { completeText } from './completion';
import { assertRenderedPromptSize, renderTemplate, type PlaceholderValues } from './placeholders';

export interface ActionComposeContext extends PlaceholderValues { os?: string; shell?: string; envSource?: string; }
export function composeAction(definition: AiActionDefinition, context: ActionComposeContext): { system: string; user: string } {
  const values = { ...context, action: definition.title, description: definition.description };
  const system = renderTemplate(definition.systemTemplate, values).text;
  const user = renderTemplate(definition.userTemplate, values).text;
  assertRenderedPromptSize(system, user);
  return { system, user };
}

export interface RunAiActionRequest {
  actionId: string;
  system: string;
  user: string;
  provider: AiProvider;
  token: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

const skip = (reason: CorrectionReason, elapsedMs: number, error?: string): AiActionResult => ({
  text: '',
  skipped: true,
  reason,
  ...(error !== undefined ? { error } : {}),
  elapsedMs,
});

/** Runs one action through the shared completion path; the system contract is not user-editable. */
export async function runAiAction(request: RunAiActionRequest): Promise<AiActionResult> {
  const started = Date.now();
  const result = await completeText({
    provider: request.provider,
    system: request.system,
    user: request.user,
    token: request.token,
    ...(request.baseUrl !== undefined ? { baseUrl: request.baseUrl } : {}),
    ...(request.model !== undefined ? { model: request.model } : {}),
    ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
    ...(request.fetch !== undefined ? { fetch: request.fetch } : {}),
  });
  const elapsedMs = Date.now() - started;
  return result.skipped
    ? skip(result.reason ?? 'provider-error', elapsedMs, result.error)
    : { text: result.text, skipped: false, elapsedMs };
}
