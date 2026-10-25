import { AI_PLACEHOLDERS, type AiActionDefinition } from '@smart-terminal/contracts';

export function toCustomId(name: string, existingIds: readonly string[]): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '') || 'action';
  const base = `custom-${slug}`;
  const ids = new Set(existingIds);
  if (!ids.has(base)) return base;
  let n = 2;
  while (ids.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function findUnknownPlaceholders(system: string, user: string): string[] {
  const valid = new Set<string>(AI_PLACEHOLDERS);
  return [...new Set([...`${system}\n${user}`.matchAll(/\{\{([^{}]+)\}\}/g)].map(m => m[1]).filter((name): name is string => !!name && !valid.has(name)))];
}

export function validateActionDraft(draft: AiActionDefinition, actions: readonly AiActionDefinition[], editingId: string | null): { error: string | null; warnings: string[] } {
  let error: string | null = null;
  if (!draft.title.trim()) error = 'Title is required.';
  else if (draft.title.length > 60) error = 'Title must be 60 characters or fewer.';
  else if (!draft.description.trim()) error = 'Description is required.';
  else if (draft.description.length > 200) error = 'Description must be 200 characters or fewer.';
  else if (!draft.systemTemplate.trim() || !draft.userTemplate.trim()) error = 'Both templates are required.';
  else if (new TextEncoder().encode(draft.systemTemplate).length > 8192 || new TextEncoder().encode(draft.userTemplate).length > 8192) error = 'Templates must be 8 KiB or fewer.';
  else if (actions.some(a => a.id !== editingId && a.title.toLowerCase() === draft.title.trim().toLowerCase())) error = 'An action with this title already exists.';
  else if (!draft.builtIn && (!/^custom-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.id) || draft.id.length > 47)) error = 'Custom action id is invalid.';
  else if (!draft.builtIn && !editingId && actions.filter(a => !a.builtIn).length >= 20) error = 'The maximum of 20 custom actions has been reached.';
  return { error, warnings: findUnknownPlaceholders(draft.systemTemplate, draft.userTemplate) };
}

export function defaultCustomTemplates(description: string): { systemTemplate: string; userTemplate: string } {
  return { systemTemplate: 'You are a helpful terminal assistant. Use the provided terminal context.', userTemplate: 'Terminal: {{terminalInfo}}\nConsole: {{console}}\nIntent: {{intent}}\nComposer: {{composer}}\nDescription: ' + description };
}
