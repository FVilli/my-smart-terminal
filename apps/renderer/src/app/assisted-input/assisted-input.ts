import { ChangeDetectionStrategy, Component, HostListener, type ElementRef, type OnDestroy, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { AiStore, correctionNotice } from '../ai/ai-store';
import { SttStore, appendTranscript, voiceLabel } from '../stt/stt-store';

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
        placeholder="Enter sends · Shift+Enter inserts a newline"
        aria-label="Assisted input"
        title="Focus composer: Ctrl+Shift+E"
        [value]="draft()"
        [disabled]="disabled()"
        (input)="draftChange.emit($any($event.target).value)"
        (keydown)="onKeydown($event)"
      ></textarea>
      <div class="bottom">
        <span class="hint">Enter sends · Shift+Enter newline</span>
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
          [class.configured]="canRecord()"
          [disabled]="!canRecord()"
          [attr.title]="voice.notice() ?? voice.status().warning ?? 'Dettatura vocale'"
          (pointerdown)="startRecording()"
          (pointerup)="stopRecording()"
          (pointerleave)="stopRecording()"
          (pointercancel)="stopRecording()"
          (click)="toggleRecording($event)"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="2" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3m-3 0h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        </button>
        <span class="voice-label" data-testid="voice-label" role="status">{{ voice.status().configured ? micLabel() : '' }}</span>
      </div>
      <button type="button" class="icon send" data-testid="assisted-send" aria-label="Send" [disabled]="!canSend()" (click)="send()"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4m-5 5 5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
      </div>
    </div>
    @if (notice(); as message) {
      <p class="notice" data-testid="ai-notice">{{ message }}</p>
    }
    @if (voice.notice(); as message) {
      <p class="notice" data-testid="stt-notice">{{ message }}</p>
    }
  `,
  styles: `
    :host { display: block; flex: none; background: var(--input-bg); border-top: 1px solid var(--border); padding: 10px 16px; }
    .composer { border: 1px solid var(--border-soft); border-radius: 8px; background: var(--input-bg); padding: 5px 8px; }
    .composer:focus-within { border-color: var(--accent); box-shadow: 0 0 0 1px rgba(76, 194, 165, .18); }
    .editor { display: block; width: 100%; min-width: 0; min-height: 46px; resize: none; background: transparent; border: 0; outline: 0; padding: 2px; color: var(--text); font-family: var(--font-mono); font-variant-ligatures: none; font-feature-settings: "liga" 0; letter-spacing: 0; font-size: 14px; overflow: auto; }
    .editor:disabled { opacity: .65; }
    .bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 26px; }
    .hint { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: 11px; }
    .actions { display: flex; flex: none; align-items: center; gap: 4px; }
    .icon { display: inline-flex; align-items: center; justify-content: center; height: 26px; padding: 0 6px; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); cursor: pointer; }
    .icon:disabled { opacity: .45; cursor: default; }
    .icon:not(:disabled):hover { background: var(--border); color: var(--text); }
    .ai { color: var(--accent); font-weight: 700; gap: 3px; }
    .ai svg { width: 15px; height: 15px; }
    .mic { color: var(--text-muted); }
    .mic.configured { color: var(--text); }
    .mic svg { width: 17px; height: 17px; }
    .send svg { width: 17px; height: 17px; }
    .send { width: 26px; padding: 0; border-radius: 50%; background: var(--accent); color: var(--terminal-bg); font-size: 15px; font-weight: 700; }
    .send:not(:disabled):hover { background: var(--accent); color: var(--terminal-bg); }
    .send:disabled { opacity: .45; }
    .voice { display: flex; flex-direction: row-reverse; align-items: center; gap: 2px; }
    .mic.listening { color: var(--accent); }
    .voice-label { max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: 10px; line-height: 1; }
    .notice { margin: 8px 0 0; min-height: 16px; color: var(--text-muted); font-size: 12px; }
  `,
})
export class AssistedInput implements OnDestroy {
  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');
  readonly draft = input('');
  /** No active session or the session is not running: editing, sending, and microphone are disabled. */
  readonly disabled = input(false);
  readonly draftChange = output<string>();
  readonly submitted = output<string>();
  protected readonly ai = inject(AiStore);
  protected readonly voice = inject(SttStore);
  protected readonly notice = signal<string | null>(null);
  protected readonly canSend = computed(() => !this.disabled() && this.draft().trim().length > 0);
  protected readonly canCorrect = computed(() => this.ai.canCorrect() && this.draft().trim().length > 0);
  protected readonly canRecord = computed(() => !this.disabled() && this.voice.status().configured);
  protected readonly micLabel = computed(() => voiceLabel(this.voice.status(), this.voice.phase(), this.voice.error()));
  private readonly unsubscribe: () => void;

  constructor() {
    this.unsubscribe = this.voice.onTranscript((text) => this.insertTranscript(text));
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
    void this.voice.start();
  }

  protected stopRecording(): void {
    void this.voice.stop();
  }

  /** Keyboard click (Enter/Space): `detail === 0`, so use the accessible toggle; mouse taps are already handled. */
  protected toggleRecording(event: MouseEvent): void {
    if (event.detail > 0) {
      return;
    }
    if (this.voice.phase() === 'recording') {
      void this.voice.stop();
    } else {
      void this.voice.start();
    }
  }

  /** Appends dictated text to the draft: there is no automatic send. */
  private insertTranscript(text: string): void {
    this.notice.set(null);
    this.draftChange.emit(appendTranscript(this.draft(), text));
  }

  protected async correctWithAi(): Promise<void> {
    const result = await this.ai.correct(this.draft());
    if (result === null) {
      return;
    }
    this.notice.set(correctionNotice(result));
    if (!result.skipped && result.changed) {
      this.draftChange.emit(result.corrected);
    }
  }
}
