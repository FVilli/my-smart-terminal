import fs from 'node:fs';
import path from 'node:path';
import {
  AI_ACTIONS_MAX,
  AI_ACTION_DESCRIPTION_MAX,
  AI_ACTION_TITLE_MAX,
  AI_TEMPLATE_MAX_BYTES,
  AI_PLACEHOLDERS,
  type AiActionDefinition,
  type AiActionsState,
} from '@smart-terminal/contracts';
import { BUILT_IN_ACTION_IDS, DEFAULT_AI_ACTIONS } from '@smart-terminal/ai';

const SCHEMA_VERSION = 1;
const CUSTOM_ID_PATTERN = /^custom-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BUILT_INS = new Map(DEFAULT_AI_ACTIONS.map((action) => [action.id, action]));

export type AiActionsErrorCode = 'INVALID_ACTION' | 'DUPLICATE_TITLE' | 'LIMIT_REACHED' | 'UNKNOWN_ACTION' | 'BUILT_IN_ACTION' | 'WRITE_FAILED';

export class AiActionsError extends Error {
  constructor(readonly code: AiActionsErrorCode) {
    super(code);
    this.name = 'AiActionsError';
  }
}

export interface AiActionsStoreOptions {
  configPath: string;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function defaults(): AiActionDefinition[] {
  return DEFAULT_AI_ACTIONS.map((action) => ({ ...action }));
}

/** Validates one stored/requested action; built-ins keep their id, title, description and flag. */
function normalizeAction(raw: unknown): AiActionDefinition {
  if (typeof raw !== 'object' || raw === null) throw new AiActionsError('INVALID_ACTION');
  const value = raw as Partial<Record<keyof AiActionDefinition, unknown>>;
  const id = value.id;
  if (typeof id !== 'string' || (BUILT_INS.has(id) === false && !CUSTOM_ID_PATTERN.test(id))) throw new AiActionsError('INVALID_ACTION');
  const builtIn = BUILT_INS.get(id);
  const title = builtIn?.title ?? value.title;
  const description = builtIn?.description ?? value.description;
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > AI_ACTION_TITLE_MAX || /[\r\n]/.test(title)) throw new AiActionsError('INVALID_ACTION');
  if (typeof description !== 'string' || description.trim().length === 0 || description.length > AI_ACTION_DESCRIPTION_MAX || /[\r\n]/.test(description)) throw new AiActionsError('INVALID_ACTION');
  for (const template of [value.systemTemplate, value.userTemplate]) {
    if (typeof template !== 'string' || template.trim().length === 0 || byteLength(template) > AI_TEMPLATE_MAX_BYTES || template.includes('\0')) {
      throw new AiActionsError('INVALID_ACTION');
    }
  }
  return {
    id,
    title: title.trim(),
    description: description.trim(),
    systemTemplate: value.systemTemplate as string,
    userTemplate: value.userTemplate as string,
    builtIn: builtIn !== undefined,
  };
}

function uniqueTitle(actions: AiActionDefinition[], candidate: AiActionDefinition): void {
  const clash = actions.some((action) => action.id !== candidate.id && action.title.toLowerCase() === candidate.title.toLowerCase());
  if (clash) throw new AiActionsError('DUPLICATE_TITLE');
}

/** Local-only action templates (tooling preferences, never synced with the data repository). */
export class AiActionsStore {
  private state: AiActionsState;

  constructor(private readonly options: AiActionsStoreOptions) {
    this.state = this.load();
  }

  list(): AiActionsState {
    return structuredClone(this.state);
  }

  save(request: { action: unknown }): AiActionsState {
    const normalized = normalizeAction(request.action);
    uniqueTitle(this.state.actions, normalized);
    const index = this.state.actions.findIndex((candidate) => candidate.id === normalized.id);
    if (index === -1 && this.state.actions.length >= AI_ACTIONS_MAX) {
      throw new AiActionsError('LIMIT_REACHED');
    }
    const actions = index === -1
      ? [...this.state.actions, normalized]
      : this.state.actions.map((candidate) => (candidate.id === normalized.id ? normalized : candidate));
    return this.commit({ actions, placeholders: AI_PLACEHOLDERS });
  }

  reset(request: { id: string }): AiActionsState {
    const id = request.id;
    const fallback = BUILT_INS.get(id);
    if (fallback === undefined) throw new AiActionsError(id.startsWith('custom-') ? 'BUILT_IN_ACTION' : 'UNKNOWN_ACTION');
    const actions = this.state.actions.map((action) => (action.id === id ? { ...fallback } : action));
    return this.commit({ actions, placeholders: AI_PLACEHOLDERS });
  }

  delete(request: { id: string }): AiActionsState {
    const id = request.id;
    if (BUILT_INS.has(id)) throw new AiActionsError('BUILT_IN_ACTION');
    const actions = this.state.actions.filter((action) => action.id !== id);
    if (actions.length === this.state.actions.length) throw new AiActionsError('UNKNOWN_ACTION');
    return this.commit({ actions, placeholders: AI_PLACEHOLDERS });
  }

  private commit(state: AiActionsState): AiActionsState {
    try {
      fs.mkdirSync(path.dirname(this.options.configPath), { recursive: true });
      const tmp = `${this.options.configPath}.tmp`;
      fs.writeFileSync(tmp, `${JSON.stringify({ schema_version: SCHEMA_VERSION, actions: state.actions }, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(tmp, this.options.configPath);
    } catch {
      // Persist before publishing: a failed write must leave the previous state authoritative.
      throw new AiActionsError('WRITE_FAILED');
    }
    this.state = state;
    return this.list();
  }

  private load(): AiActionsState {
    let raw: string;
    try {
      raw = fs.readFileSync(this.options.configPath, 'utf8');
    } catch {
      return { actions: defaults(), placeholders: AI_PLACEHOLDERS };
    }
    try {
      const parsed = JSON.parse(raw) as { schema_version?: unknown; actions?: unknown };
      if (parsed.schema_version !== SCHEMA_VERSION || !Array.isArray(parsed.actions)) throw new Error('shape');
      const actions: AiActionDefinition[] = parsed.actions.map((action) => normalizeAction(action));
      // Add missing built-ins with defaults, keep every other validated action, enforce the limit.
      for (const id of BUILT_IN_ACTION_IDS) {
        if (!actions.some((action) => action.id === id)) {
          actions.push({ ...(BUILT_INS.get(id) as AiActionDefinition) });
        }
      }
      const unique = new Map<string, AiActionDefinition>();
      for (const action of actions) unique.set(action.id, action);
      const bounded = [...unique.values()].slice(0, AI_ACTIONS_MAX);
      const titles = new Set<string>();
      for (const action of bounded) {
        const key = action.title.toLowerCase();
        if (titles.has(key)) throw new Error('duplicate title');
        titles.add(key);
      }
      return { actions: bounded, placeholders: AI_PLACEHOLDERS };
    } catch {
      return {
        actions: defaults(),
        placeholders: AI_PLACEHOLDERS,
        warning: 'Stored AI actions were invalid: defaults were loaded.',
      };
    }
  }
}
