import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AI_ACTIONS_MAX, type AiActionDefinition } from '@smart-terminal/contracts';
import { DEFAULT_AI_ACTIONS } from '@smart-terminal/ai';
import { AiActionsError, AiActionsStore } from './ai-actions-store';

let root: string;
let configPath: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-ai-actions-'));
  configPath = path.join(root, 'config', 'ai-actions.json');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const custom = (overrides: Partial<AiActionDefinition> = {}): AiActionDefinition => ({
  id: 'custom-review',
  title: 'Review diff',
  description: 'Review a diff before committing',
  systemTemplate: 'Review the changes. OS {{os}} shell {{shell}}.',
  userTemplate: 'Diff:\n{{composer}}',
  builtIn: false,
  ...overrides,
});

describe('AiActionsStore', () => {
  it('starts from the five built-in defaults with usable templates', () => {
    const store = new AiActionsStore({ configPath });
    const state = store.list();
    expect(state.actions.map((action) => action.id)).toEqual(DEFAULT_AI_ACTIONS.map((action) => action.id));
    expect(state.actions.every((action) => action.builtIn)).toBe(true);
    expect(state.placeholders).toContain('console');
    expect(state.actions.find((action) => action.id === 'suggest-command')?.systemTemplate).toContain('{{terminalInfo}}');
    expect(fs.existsSync(configPath)).toBe(false);
  });

  it('saves custom actions, reloads them and keeps built-in titles fixed', () => {
    const store = new AiActionsStore({ configPath });
    store.save({ action: custom() });
    expect(fs.statSync(configPath).mode & 0o777).toBe(0o600);
    const reloaded = new AiActionsStore({ configPath }).list();
    expect(reloaded.actions.find((action) => action.id === 'custom-review')).toMatchObject({ title: 'Review diff', builtIn: false });
    const builtIn = store.list().actions.find((action) => action.id === 'fix-message') as AiActionDefinition;
    store.save({ action: { ...builtIn, title: 'Renamed', systemTemplate: 'Custom system {{os}}', userTemplate: 'Custom user {{composer}}' } });
    const saved = store.list().actions.find((action) => action.id === 'fix-message');
    expect(saved).toMatchObject({ title: builtIn.title, systemTemplate: 'Custom system {{os}}' });
  });

  it('rejects duplicates, limits, invalid templates and built-in deletion', () => {
    const store = new AiActionsStore({ configPath });
    store.save({ action: custom() });
    expect(() => store.save({ action: custom({ id: 'custom-other' }) })).toThrow(expect.objectContaining({ code: 'DUPLICATE_TITLE' }));
    expect(() => store.save({ action: custom({ id: 'custom-bad', systemTemplate: '   ' }) })).toThrow(expect.objectContaining({ code: 'INVALID_ACTION' }));
    expect(() => store.save({ action: custom({ id: 'custom-bad', title: 'x'.repeat(61) }) })).toThrow(expect.objectContaining({ code: 'INVALID_ACTION' }));
    expect(() => store.save({ action: custom({ id: 'not-a-custom-id' }) })).toThrow(expect.objectContaining({ code: 'INVALID_ACTION' }));
    expect(() => store.delete({ id: 'fix-message' })).toThrow(expect.objectContaining({ code: 'BUILT_IN_ACTION' }));
    expect(() => store.delete({ id: 'custom-missing' })).toThrow(expect.objectContaining({ code: 'UNKNOWN_ACTION' }));
    while (store.list().actions.length < AI_ACTIONS_MAX) {
      const count = store.list().actions.length;
      store.save({ action: custom({ id: `custom-a${count}`, title: `Action ${count}` }) });
    }
    expect(() => store.save({ action: custom({ id: 'custom-overflow', title: 'Overflow' }) })).toThrow(expect.objectContaining({ code: 'LIMIT_REACHED' }));
  });

  it('resets built-ins, deletes custom actions and falls back on corrupt files', () => {
    const store = new AiActionsStore({ configPath });
    store.save({ action: { ...(store.list().actions.find((action) => action.id === 'explain-command') as AiActionDefinition), systemTemplate: 'changed {{os}}' } });
    expect(store.list().actions.find((action) => action.id === 'explain-command')?.systemTemplate).toBe('changed {{os}}');
    store.reset({ id: 'explain-command' });
    expect(store.list().actions.find((action) => action.id === 'explain-command')?.systemTemplate).toBe(DEFAULT_AI_ACTIONS[1]?.systemTemplate);
    store.save({ action: custom() });
    store.delete({ id: 'custom-review' });
    expect(store.list().actions.some((action) => action.id === 'custom-review')).toBe(false);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, '{ not json');
    const corrupt = new AiActionsStore({ configPath }).list();
    expect(corrupt.warning).toContain('defaults');
    expect(corrupt.actions).toHaveLength(DEFAULT_AI_ACTIONS.length);
  });

  it('keeps the previous state when persistence fails', () => {
    const blockedParent = path.join(root, 'blocked');
    fs.writeFileSync(blockedParent, 'not a directory');
    const store = new AiActionsStore({ configPath: path.join(blockedParent, 'config', 'ai-actions.json') });
    const before = store.list();
    expect(() => store.save({ action: custom() })).toThrow(expect.objectContaining({ code: 'WRITE_FAILED' }));
    expect(store.list()).toEqual(before);
    expect(store.list().actions.some((action) => action.id === 'custom-review')).toBe(false);
  });

  it('exposes typed errors', () => {
    expect(new AiActionsError('INVALID_ACTION').code).toBe('INVALID_ACTION');
  });
});
