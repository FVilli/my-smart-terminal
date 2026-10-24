import { ChangeDetectionStrategy, Component, HostListener, type ElementRef, type OnDestroy, computed, effect, inject, input, output, viewChild } from '@angular/core';
import { AiStore, correctionNotice } from '../ai/ai-store';
import { SttStore, voiceLabel } from '../stt/stt-store';
import { SettingsStore } from '../settings/settings-store';
import { AppearanceStore } from '../appearance/appearance-store';
import { MessageStore } from '../messages/message-store';

@Component({
  selector: 'app-assisted-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="composer">
      <textarea
        class="editor"
        data-testid="assisted-textarea"
        #textarea
        rows="2"
        spellcheck="false"
        placeholder="Enter sends · Shift+Enter newline"
        aria-label="Assisted input"
        title="Focus composer: Ctrl+Shift+E"
        [value]="draft()"
        [disabled]="disabled()"
        (input)="draftChange.emit($any($event.target).value)"
        (keydown)="onKeydown($event)"
      ></textarea>
      <div class="actions">
      <button
        type="button"
        class="icon ai"
        data-testid="ai-correction"
        aria-label="AI correction"
        [disabled]="!canCorrect()"
        [attr.title]="ai.status().warning ?? 'Fix typos with AI'"
        (click)="correctWithAi()"
      >
        @if (ai.busy()) { … } @else { <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5 12 7l5.5 2-5.5 2-2 5.5L8 11 2.5 9 8 7z" fill="currentColor"/><path d="m16 13 .9 2.1L19 16l-2.1.9L16 19l-.9-2.1L13 16l2.1-.9z" fill="currentColor"/></svg><span>AI</span> }
      </button>
      <div class="voice">
        <button
          type="button"
          class="icon mic"
          data-testid="assisted-mic"
          [attr.aria-label]="micLabel()"
          [attr.aria-pressed]="voice.phase() === 'recording'"
          [class.listening]="voice.phase() === 'recording'"
          [class.configured]="voice.status().configured"
          [attr.title]="voice.notice() ?? voice.status().warning ?? (voice.phase() === 'recording' ? 'Stop recording' : 'Start dictation')"
          (click)="toggleRecording($event)"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="2" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3m-3 0h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        </button>
        <span class="voice-label" data-testid="voice-label" role="status">{{ voice.status().configured ? micLabel() : '' }}</span>
      </div>
      <button type="button" class="icon send" data-testid="assisted-send" aria-label="Send" [disabled]="!canSend()" (click)="send()"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4m-5 5 5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; flex: none; background: var(--terminal-bg); border-top: 1px solid var(--border); padding: 8px 16px; }
    .composer { display: flex; align-items: stretch; gap: 8px; height: 120px; min-height: 120px; border: 1px solid var(--border-soft); border-radius: 8px; background: var(--input-bg); padding: 5px 6px 5px 8px; }
    .composer:focus-within { border-color: var(--accent); box-shadow: 0 0 0 1px rgba(76, 194, 165, .18); }
    .editor { display: block; flex: 1 1 auto; width: 100%; height: 100%; min-width: 0; min-height: 0; resize: none; background: transparent; border: 0; outline: 0; padding: 2px 4px 2px 2px; color: var(--text); font-family: var(--font-mono), monospace; font-size: 14px; font-weight: 400; font-style: normal; line-height: 1.5; font-variant-ligatures: none; font-feature-settings: "liga" 0; letter-spacing: 0; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; }
    .editor:disabled { opacity: .65; }
    .editor::placeholder { color: var(--text-muted); opacity: 1; font-family: inherit; font-size: inherit; font-weight: inherit; font-style: inherit; line-height: inherit; }
    .actions { display: flex; flex: 0 0 30px; flex-direction: column; align-items: center; justify-content: center; gap: 7px; min-width: 0; }
    .icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 26px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); cursor: pointer; }
    .icon:disabled { opacity: .45; cursor: default; }
    .icon:not(:disabled):hover { background: var(--border); color: var(--text); }
    .ai { color: var(--accent); font-weight: 700; gap: 3px; }
    .ai svg { width: 15px; height: 15px; }
    .ai { flex-direction: row; gap: 2px; font-size: 10px; }
    .mic { color: var(--text-muted); }
    .mic.configured { color: var(--text); }
    .mic svg { width: 17px; height: 17px; }
    .send svg { width: 17px; height: 17px; }
    .send { width: 26px; padding: 0; border-radius: 50%; background: var(--accent); color: var(--terminal-bg); font-size: 15px; font-weight: 700; }
    .send:not(:disabled):hover { background: var(--accent); color: var(--terminal-bg); }
    .send:disabled { opacity: .45; }
    .voice { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .mic.listening { color: #e5484d; }
    .voice-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `,
})
export class AssistedInput implements OnDestroy {
  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');
  private readonly settings = inject(SettingsStore);
  protected readonly appearance = inject(AppearanceStore);
  private readonly messages = inject(MessageStore);
  readonly draft = input('');
  /** No active session or the session is not running: editing, sending, and microphone are disabled. */
  readonly disabled = input(false);
  readonly draftChange = output<string>();
  readonly submitted = output<string>();
  protected readonly ai = inject(AiStore);
  protected readonly voice = inject(SttStore);
  protected readonly canSend = computed(() => !this.disabled() && this.draft().trim().length > 0);
  protected readonly canCorrect = computed(() => this.ai.canCorrect() && this.draft().trim().length > 0);
  protected readonly canRecord = computed(() => !this.disabled() && this.voice.status().configured);
  protected readonly micLabel = computed(() => voiceLabel(this.voice.status(), this.voice.phase(), this.voice.error()));
  private readonly unsubscribe: () => void;

  constructor() {
    this.unsubscribe = this.voice.onTranscript((text) => this.insertTranscript(text));
    effect(() => {
      const message = this.voice.notice();
      if (message !== null) this.messages.show('warning', message);
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe();
    this.voice.halt();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !event.isComposing) {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('smart-terminal-focus-terminal'));
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) {
      return;
    }
    event.preventDefault();
    this.send();
  }

  protected send(): void {
    if (this.canSend()) {
      this.submitted.emit(this.draft());
      queueMicrotask(() => this.textarea().nativeElement.focus());
    }
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      this.textarea().nativeElement.focus();
    }
  }

  /** Push-to-talk: pressing the button records; releasing it (or leaving) transcribes into the draft. */
  protected startRecording(): void {
    if (!this.canRecord()) { this.settings.openSettings('stt'); return; }
    void this.voice.start();
  }

  protected openSttSettings(): void {
    this.settings.openSettings('stt');
  }

  protected stopRecording(): void {
    void this.voice.stop();
  }

  /** Click toggles dictation: first click records, second click stops and transcribes. */
  protected toggleRecording(_event: MouseEvent): void {
    if (this.voice.phase() === 'transcribing') return;
    if (!this.canRecord()) {
      this.openSttSettings();
      return;
    }
    if (this.voice.phase() === 'recording') {
      void this.voice.stop();
    } else {
      void this.voice.start();
    }
  }

  /** Inserts dictated text at the caret (or replaces the current selection); never sends it. */
  private insertTranscript(text: string): void {
    const value = this.draft();
    const element = this.textarea().nativeElement;
    const start = element.selectionStart ?? value.length;
    const end = element.selectionEnd ?? start;
    const dictated = text.trim();
    if (dictated.length === 0) return;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const prefix = before.length > 0 && !/\s$/.test(before) ? ' ' : '';
    const suffix = after.length > 0 && !/^\s/.test(after) ? ' ' : '';
    const next = `${before}${prefix}${dictated}${suffix}${after}`;
    this.draftChange.emit(next);
    queueMicrotask(() => {
      const caret = before.length + prefix.length + dictated.length;
      element.focus();
      element.setSelectionRange(caret, caret);
    });
  }

  protected async correctWithAi(): Promise<void> {
    const result = await this.ai.correct(this.draft());
    if (result === null) {
      return;
    }
    this.messages.show('info', correctionNotice(result));
    if (!result.skipped && result.changed) {
      this.draftChange.emit(result.corrected);
    }
  }
}
