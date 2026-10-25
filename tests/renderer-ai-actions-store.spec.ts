import '@angular/compiler';
import { createEnvironmentInjector, Injector, type EnvironmentInjector } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AiActionsStore } from '../apps/renderer/src/app/ai/ai-actions-store';
import { SessionsStore } from '../apps/renderer/src/app/sessions-store';
import { AiStore } from '../apps/renderer/src/app/ai/ai-store';

const definition = (id: string, title: string) => ({ id, title, description: `${title} description`, systemTemplate: `System ${id}`, userTemplate: `User ${id}`, builtIn: true });
const definitions = [definition('suggest-command', 'Suggest a command'), definition('fix-message', 'Fix message for agent')];

function setup(api: Record<string, unknown>, sessions: Record<string, unknown>) {
  Object.assign(globalThis, { smartTerminal: api });
  const injector = createEnvironmentInjector([
    { provide: SessionsStore, useValue: sessions },
    { provide: AiActionsStore, useClass: AiActionsStore },
    { provide: AiStore, useClass: AiStore },
  ], Injector.NULL as unknown as EnvironmentInjector);
  return { store: injector.get(AiActionsStore), ai: injector.get(AiStore) };
}

const baseApi = () => ({
  aiActionsList: vi.fn(async () => ({ actions: definitions, placeholders: ['console'] })),
  aiCompose: vi.fn(async ({ actionId }: { actionId: string }) => ({ system: `system:${actionId}`, user: `user:${actionId}` })),
  aiAction: vi.fn(async () => ({ text: 'answer text', skipped: false, elapsedMs: 1 })),
  aiStatus: vi.fn(async () => ({ configured: true, provider: 'openai' as const, hasToken: true, secureStorage: true })),
  detectSessionEnvironment: vi.fn(async () => ({ os: 'linux', shell: 'bash', source: 'local' })),
});

const session = {
  activeId: () => 's1',
  activeDraft: () => 'draft text',
  activeSession: () => ({ label: 'S1', kind: 'local', environment: { os: 'linux', shell: 'bash', source: 'local' } }),
};

describe('AiActionsStore', () => {
  it('composes with draft, terminal info and environment, and sends both edited prompts', async () => {
    const api = baseApi();
    const { store, ai } = setup(api, session);
    await ai.load();
    await store.show();
    expect(api.aiActionsList).toHaveBeenCalled();
    expect(api.aiCompose).toHaveBeenCalledWith({
      actionId: 'suggest-command',
      composerText: 'draft text',
      consoleText: '',
      terminalInfo: 'S1 · local · linux · bash',
      environment: { os: 'linux', shell: 'bash', source: 'local' },
    });
    expect(store.system()).toBe('system:suggest-command');
    expect(store.user()).toBe('user:suggest-command');
    await store.selectAction('fix-message');
    store.setSystem('edited system');
    store.setUser('edited user');
    await store.send();
    expect(api.aiAction).toHaveBeenCalledWith({ actionId: 'fix-message', system: 'edited system', user: 'edited user' });
    expect(store.phase()).toBe('answered');
    store.selectedAnswer.set('answer');
    expect(store.useText()).toBe('answer');
  });

  it('retains both prompts on Close, discards on Cancel, and ignores late answers', async () => {
    const api = baseApi();
    let resolveAction: (value: { text: string; skipped: boolean; elapsedMs: number }) => void = () => undefined;
    api.aiAction.mockImplementation(() => new Promise((resolve) => { resolveAction = resolve as typeof resolveAction; }));
    const { store, ai } = setup(api, session);
    await ai.load();
    await store.show();
    store.setSystem('kept system');
    store.setUser('kept user');
    store.keepAndClose();
    await store.show();
    expect(store.system()).toBe('kept system');
    expect(store.user()).toBe('kept user');
    const pending = store.send();
    store.keepAndClose();
    resolveAction({ text: 'late', skipped: false, elapsedMs: 1 });
    await pending;
    expect(store.answer()).toBe('');
    store.cancel();
    await store.show();
    expect(store.system()).toBe('system:suggest-command');
  });

  it('maps sensitive skips to blocked and detects the environment', async () => {
    const api = baseApi();
    api.aiAction.mockResolvedValueOnce({ text: '', skipped: true, reason: 'sensitive', elapsedMs: 1 } as never);
    const { store, ai } = setup(api, session);
    await ai.load();
    await store.show();
    await store.send();
    expect(store.phase()).toBe('blocked');
    expect(store.notice()).toContain('sensitive');
    await store.detectEnvironment();
    expect(api.detectSessionEnvironment).toHaveBeenCalledWith({ sessionId: 's1' });
  });
});
