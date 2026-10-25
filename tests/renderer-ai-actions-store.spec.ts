import '@angular/compiler';
import { createEnvironmentInjector, Injector, type EnvironmentInjector } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AiActionsStore } from '../apps/renderer/src/app/ai/ai-actions-store';
import { SessionsStore } from '../apps/renderer/src/app/sessions-store';
import { AiStore } from '../apps/renderer/src/app/ai/ai-store';

describe('AiActionsStore',()=>{
 it('composes actions with draft and environment, sends and exposes selected text',async()=>{
  const api={aiCompose:vi.fn(async ({action}:{action:string})=>({prompt:`${action} <user_body>draft</user_body>`})),aiAction:vi.fn(async()=>({text:'answer text',skipped:false,elapsedMs:1})),aiStatus:vi.fn(async()=>({configured:true,provider:'openai' as const,hasToken:true,secureStorage:true}))};
  Object.assign(globalThis,{smartTerminal:api});
  const sessions={activeId:()=> 's1',activeDraft:()=> 'draft',activeSession:()=>({environment:{os:'linux',shell:'bash',source:'local'}})};
  const injector=createEnvironmentInjector([{provide:SessionsStore,useValue:sessions},{provide:AiActionsStore,useClass:AiActionsStore},{provide:AiStore,useClass:AiStore}], Injector.NULL as unknown as EnvironmentInjector);
  const store=injector.get(AiActionsStore); const ai=injector.get(AiStore);
  await ai.load(); await store.show(); expect(api.aiCompose).toHaveBeenCalledWith(expect.objectContaining({action:'suggest-command',input:'draft',environment:{os:'linux',shell:'bash',source:'local'}}));
  await store.selectAction('fix-message'); expect(store.prompt()).toContain('<user_body>'); await store.send(); expect(store.phase()).toBe('answered');
  store.selectedAnswer.set('answer'); expect(store.useText()).toBe('answer'); store.selectedAnswer.set(''); expect(store.useText()).toBe('answer text');
  store.requestInsert('answer text'); expect(store.pendingInsert()).toBe('answer text'); store.consumeInsert(); expect(store.pendingInsert()).toBeNull();
 });
 it('keeps prompts on Close and discards them on Cancel',async()=>{
  const api={aiCompose:vi.fn(async()=>({prompt:'composed'})),aiAction:vi.fn()}; Object.assign(globalThis,{smartTerminal:api});
  const injector=createEnvironmentInjector([{provide:SessionsStore,useValue:{activeId:()=> 'one',activeDraft:()=>'',activeSession:()=>null}},{provide:AiActionsStore,useClass:AiActionsStore},{provide:AiStore,useClass:AiStore}], Injector.NULL as unknown as EnvironmentInjector);
  const s=injector.get(AiActionsStore); await s.show(); s.setPrompt('kept'); s.keepAndClose(); await s.show(); expect(s.prompt()).toBe('kept'); s.cancel(); await s.show(); expect(s.prompt()).toBe('composed');
 });

 it('maps sensitive skips to the blocked state and ignores late answers', async()=>{
  let resolveAction: (value: unknown) => void = () => undefined;
  const api={aiCompose:vi.fn(async()=>({prompt:'p'})),aiAction:vi.fn(()=>new Promise((resolve)=>{resolveAction=resolve;})),aiStatus:vi.fn(async()=>({configured:true,provider:'openai' as const,hasToken:true,secureStorage:true}))};
  Object.assign(globalThis,{smartTerminal:api});
  const injector=createEnvironmentInjector([{provide:SessionsStore,useValue:{activeId:()=> 'one',activeDraft:()=> 'draft',activeSession:()=>null}},{provide:AiActionsStore,useClass:AiActionsStore},{provide:AiStore,useClass:AiStore}], Injector.NULL as unknown as EnvironmentInjector);
  const store=injector.get(AiActionsStore); await injector.get(AiStore).load(); await store.show();
  const pending=store.send();
  store.keepAndClose();
  resolveAction({text:'late',skipped:false,elapsedMs:1});
  await pending;
  expect(store.answer()).toBe('');
  expect(store.open()).toBe(false);
  api.aiAction.mockResolvedValueOnce({text:'',skipped:true,reason:'sensitive',elapsedMs:1});
  await store.show(); await store.send();
  expect(store.phase()).toBe('blocked');
  expect(store.notice()).toContain('sensitive');
  expect(store.answer()).toBe('');
 });
});
