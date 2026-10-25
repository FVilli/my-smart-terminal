import { AI_PLACEHOLDERS, AI_RENDERED_PROMPT_MAX_BYTES } from '@smart-terminal/contracts';
import type { AiPlaceholder } from '@smart-terminal/contracts';

export type PlaceholderValues = Partial<Record<AiPlaceholder, string | undefined>>;
export interface RenderedTemplate { text: string; used: string[]; unknown: string[]; }
export function renderTemplate(template: string, values: PlaceholderValues): RenderedTemplate {
  const used: string[] = []; const unknown: string[] = [];
  const text = template.replace(/{{([^{}]+)}}/g, (literal, name: string) => {
    if (!(AI_PLACEHOLDERS as readonly string[]).includes(name)) { if (!unknown.includes(name)) unknown.push(name); return literal; }
    if (!used.includes(name)) used.push(name);
    return values[name as AiPlaceholder] ?? (name === 'os' || name === 'shell' || name === 'envSource' ? 'unknown' : '');
  });
  return { text, used, unknown };
}
export function assertRenderedPromptSize(system: string, user: string): void {
  if (new TextEncoder().encode(system).length + new TextEncoder().encode(user).length > AI_RENDERED_PROMPT_MAX_BYTES) {
    const error = new Error('Rendered AI prompts exceed the 32 KiB limit.'); error.name = 'INVALID_ACTION'; throw error;
  }
}
