import { Injectable, computed, inject, signal } from '@angular/core';
import { AI_ACTION_IDS, AI_RENDERED_PROMPT_MAX_BYTES, type AiActionDefinition, type AiActionResult, type SmartTerminalApi } from '@smart-terminal/contracts';
import { AiStore } from './ai-store';
import { SessionsStore } from '../sessions-store';

@Injectable({ providedIn: 'root' })
export class AiActionsStore {
  private readonly api = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  private readonly sessions = inject(SessionsStore);
  readonly ai = inject(AiStore);
  readonly open = signal(false);
  readonly actions = signal<Pick<AiActionDefinition, 'id'|'title'|'description'>[]>(AI_ACTION_IDS.map(id => ({id,title:id,description:''})));
  readonly actionId = signal('suggest-command');
  readonly system = signal('');
  readonly user = signal('');
  readonly answer = signal('');
  readonly phase = signal<'idle'|'composing'|'sending'|'answered'|'error'|'blocked'>('idle');
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly selectedAnswer = signal('');
  readonly pendingInsert = signal<string | null>(null);
  readonly detecting = signal(false);
  readonly promptTooLong = computed(() => new TextEncoder().encode(this.system()).length + new TextEncoder().encode(this.user()).length > AI_RENDERED_PROMPT_MAX_BYTES);
  private readonly keptPrompt = new Map<string, { actionId: string; system: string; user: string }>();
  private sequence = 0;

  async show(): Promise<void> {
    this.open.set(true); this.answer.set(''); this.selectedAnswer.set(''); this.error.set(null); this.notice.set(null);
    try { this.actions.set((await this.api.aiActionsList()).actions.map(({id,title,description})=>({id,title,description}))); } catch { /* retain built-in fallback */ }
    const id = this.sessions.activeId(); const kept = id ? this.keptPrompt.get(id) : undefined;
    if (kept) { this.actionId.set(kept.actionId); this.system.set(kept.system); this.user.set(kept.user); this.phase.set('idle'); }
    else await this.selectAction(this.actions()[0]?.id ?? 'suggest-command');
  }
  close(): void { this.sequence++; this.open.set(false); this.answer.set(''); this.selectedAnswer.set(''); this.phase.set('idle'); }
  cancel(): void { const id=this.sessions.activeId(); if(id)this.keptPrompt.delete(id); this.system.set(''); this.user.set(''); this.answer.set(''); this.selectedAnswer.set(''); this.close(); }
  keepAndClose(): void { const id=this.sessions.activeId(); if(id)this.keptPrompt.set(id,{actionId:this.actionId(),system:this.system(),user:this.user()}); this.close(); }
  async selectAction(id: string): Promise<void> {
    this.actionId.set(id); this.answer.set(''); this.selectedAnswer.set(''); this.error.set(null); this.notice.set(null); this.phase.set('composing');
    const session=this.sessions.activeSession();
    const environment=session?.environment ? {os:session.environment.os,shell:session.environment.shell,source:session.environment.source} : undefined;
    const terminalInfo=session ? `${session.label ?? 'unknown'} · ${session.kind ?? 'unknown'} · ${session.environment?.os ?? 'unknown'} · ${session.environment?.shell ?? 'unknown'}` : 'unknown · unknown · unknown · unknown';
    try { const result=await this.api.aiCompose({actionId:id,composerText:this.sessions.activeDraft(),consoleText:'',terminalInfo,...(environment?{environment}:{})}); this.system.set(result.system); this.user.set(result.user); this.phase.set('idle'); }
    catch { this.error.set('Could not prepare the AI prompt.'); this.phase.set('error'); }
  }
  async send(): Promise<void> {
    if(this.phase()==='sending'||!this.ai.status().configured||!this.system().trim()||!this.user().trim()||this.promptTooLong())return;
    const seq=++this.sequence; this.phase.set('sending'); this.answer.set(''); this.selectedAnswer.set(''); this.error.set(null); this.notice.set(null);
    try { const result: AiActionResult=await this.api.aiAction({actionId:this.actionId(),system:this.system(),user:this.user()}); if(seq!==this.sequence)return;
      if(result.skipped){const messages:Record<string,string>={unconfigured:'AI provider is not configured.','missing-token':'AI token is missing. Open AI settings to configure it.',timeout:'The AI request timed out.','provider-error':'The AI provider could not complete the request.',empty:'The AI returned an empty answer.',sensitive:'This prompt contains sensitive content and was not sent.'};this.notice.set(messages[result.reason??'']??'The AI action could not be completed.');this.error.set(this.notice());this.phase.set(result.reason==='sensitive'?'blocked':'error');}
      else if(!result.text.trim()){this.error.set('The AI returned an empty answer.');this.phase.set('error');} else {this.answer.set(result.text);this.phase.set('answered');}
    } catch {if(seq===this.sequence){this.error.set('The AI request failed.');this.phase.set('error');}}
  }
  useText():string|null{const selected=this.selectedAnswer();if(selected.length)return selected;const text=this.answer().trim();return text||null;}
  async detectEnvironment():Promise<void>{const id=this.sessions.activeId();if(id===null||this.detecting())return;this.detecting.set(true);try{await this.api.detectSessionEnvironment({sessionId:id});}catch{this.notice.set('Environment detection failed.');}finally{this.detecting.set(false);}}
  requestInsert(text:string):void{this.pendingInsert.set(text);} consumeInsert():void{this.pendingInsert.set(null);}
  setSystem(value:string):void{this.system.set(value);if(this.phase()!=='sending')this.phase.set('composing');}
  setUser(value:string):void{this.user.set(value);if(this.phase()!=='sending')this.phase.set('composing');}
}
