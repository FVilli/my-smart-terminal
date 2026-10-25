import { Injectable, computed, inject, signal } from '@angular/core';
import { AI_ACTION_MAX_PROMPT_BYTES, type AiActionId, type AiActionResult, type SmartTerminalApi } from '@smart-terminal/contracts';
import { AiStore } from './ai-store';
import { SessionsStore } from '../sessions-store';

@Injectable({ providedIn: 'root' })
export class AiActionsStore {
  private readonly api = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  private readonly sessions = inject(SessionsStore);
  readonly ai = inject(AiStore);
  readonly open = signal(false);
  readonly actionId = signal<AiActionId>('suggest-command');
  readonly prompt = signal('');
  readonly answer = signal('');
  readonly phase = signal<'idle'|'composing'|'sending'|'answered'|'error'|'blocked'>('idle');
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly selectedAnswer = signal('');
  /** Hand-off to the composer: non-null while a `Use` insertion is pending. */
  readonly pendingInsert = signal<string | null>(null);
  readonly promptTooLong = computed(() => new TextEncoder().encode(this.prompt()).length > AI_ACTION_MAX_PROMPT_BYTES);
  private readonly keptPrompt = new Map<string, { action: AiActionId; prompt: string }>();
  private sequence = 0;

  async show(): Promise<void> {
    this.open.set(true); this.answer.set(''); this.selectedAnswer.set(''); this.error.set(null); this.notice.set(null);
    const id = this.sessions.activeId();
    const kept = id ? this.keptPrompt.get(id) : undefined;
    if (kept) { this.actionId.set(kept.action); this.prompt.set(kept.prompt); this.phase.set('idle'); }
    else { this.actionId.set('suggest-command'); await this.selectAction('suggest-command'); }
  }
  close(): void { this.sequence++; this.open.set(false); this.answer.set(''); this.selectedAnswer.set(''); this.phase.set('idle'); }
  cancel(): void { const id=this.sessions.activeId(); if(id) this.keptPrompt.delete(id); this.prompt.set(''); this.answer.set(''); this.selectedAnswer.set(''); this.close(); }
  keepAndClose(): void { const id=this.sessions.activeId(); if(id) this.keptPrompt.set(id,{action:this.actionId(),prompt:this.prompt()}); this.close(); }
  async selectAction(id: AiActionId): Promise<void> {
    this.actionId.set(id); this.answer.set(''); this.selectedAnswer.set(''); this.error.set(null); this.notice.set(null); this.phase.set('composing');
    const session=this.sessions.activeSession();
    const environment=session?.environment ? { os:session.environment.os,shell:session.environment.shell,source:session.environment.source } : undefined;
    try { const result=await this.api.aiCompose({ action:id,input:this.sessions.activeDraft(),...(environment?{environment}:{}) }); this.prompt.set(result.prompt); this.phase.set('idle'); }
    catch { this.error.set('Could not prepare the AI prompt.'); this.phase.set('error'); }
  }
  async send(): Promise<void> {
    if(this.phase()==='sending'||!this.ai.status().configured||!this.prompt().trim()||this.promptTooLong()) return;
    const seq=++this.sequence; this.phase.set('sending'); this.answer.set(''); this.selectedAnswer.set(''); this.error.set(null); this.notice.set(null);
    try {
      const result: AiActionResult=await this.api.aiAction({action:this.actionId(),prompt:this.prompt()});
      if(seq!==this.sequence)return;
      if(result.skipped){ const messages: Record<string,string>={unconfigured:'AI provider is not configured.', 'missing-token':'AI token is missing. Open AI settings to configure it.', timeout:'The AI request timed out.', 'provider-error':'The AI provider could not complete the request.', empty:'The AI returned an empty answer.', sensitive:'This prompt contains sensitive content and was not sent.'}; this.notice.set(messages[result.reason ?? ''] ?? 'The AI action could not be completed.'); this.error.set(this.notice()); this.phase.set(result.reason==='sensitive'?'blocked':'error'); }
      else if(!result.text.trim()){this.error.set('The AI returned an empty answer.');this.phase.set('error');}
      else {this.answer.set(result.text);this.phase.set('answered');}
    } catch { if(seq===this.sequence){this.error.set('The AI request failed.');this.phase.set('error');} }
  }
  useText(): string | null { const selected=this.selectedAnswer(); if(selected.length)return selected; const text=this.answer().trim(); return text||null; }
  /** Queues the answer (selection or full text) for the composer; never submits it. */
  requestInsert(text: string): void { this.pendingInsert.set(text); }
  consumeInsert(): void { this.pendingInsert.set(null); }
  setPrompt(value:string):void { this.prompt.set(value); if(this.phase()!=='sending')this.phase.set('composing'); }
}
