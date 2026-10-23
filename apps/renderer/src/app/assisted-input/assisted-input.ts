import { ChangeDetectionStrategy, Component, type OnDestroy, computed, inject, input, output, signal } from '@angular/core';
import { AiStore, correctionNotice } from '../ai/ai-store';
import { SttStore, appendTranscript, voiceLabel } from '../stt/stt-store';

@Component({
  selector: 'app-assisted-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <button
        type="button"
        class="icon ai"
        data-testid="ai-correction"
        aria-label="AI correction"
        [disabled]="!canCorrect()"
        [attr.title]="ai.status().warning ?? 'Fix typos with AI'"
        (click)="correctWithAi()"
      >
        {{ ai.busy() ? '…' : 'AI' }}
      </button>
      <textarea
        class="editor"
        data-testid="assisted-textarea"
        rows="3"
        spellcheck="false"
        placeholder="Enter sends · Shift+Enter inserts a newline"
        aria-label="Assisted input"
        [value]="draft()"
        [disabled]="disabled()"
        (input)="draftChange.emit($any($event.target).value)"
        (keydown)="onKeydown($event)"
      ></textarea>
      <button type="button" class="icon send" data-testid="assisted-send" aria-label="Send" [disabled]="!canSend()" (click)="send()">⏎</button>
      <div class="voice">
        <button
          type="button"
          class="icon mic"
          data-testid="assisted-mic"
          [attr.aria-label]="micLabel()"
          [attr.aria-pressed]="voice.phase() === 'recording'"
          [class.listening]="voice.phase() === 'recording'"
          [disabled]="!canRecord()"
          [attr.title]="voice.notice() ?? voice.status().warning ?? 'Dettatura vocale'"
          (pointerdown)="startRecording()"
          (pointerup)="stopRecording()"
          (pointerleave)="stopRecording()"
          (pointercancel)="stopRecording()"
          (click)="toggleRecording($event)"
        >
          🎤
        </button>
        <span class="voice-label" data-testid="voice-label" role="status">{{ micLabel() }}</span>
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
    :host { display: block; flex: none; background: var(--tab-bg); border-top: 1px solid var(--border); padding: 10px 12px; }
    .row { display: flex; align-items: stretch; gap: 10px; min-width: 0; }
    .editor {
      flex: 1 1 0; min-width: 0; resize: none; background: var(--input-bg); border: 1px solid var(--border);
      border-radius: 6px; padding: 8px 10px; font-family: var(--font-mono); font-size: 14px; overflow: auto;
    }
    .editor:focus { outline: 1px solid var(--accent); }
    .icon { background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; width: 44px; cursor: pointer; }
    .icon:disabled { color: var(--text-muted); cursor: default; }
    .ai { color: var(--accent); font-weight: 700; }
    .voice { display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 4px; max-width: 96px; }
    .voice .icon { flex: 1; min-height: 32px; }
    .mic.listening { border-color: var(--accent); color: var(--accent); }
    .voice-label { font-size: 11px; line-height: 1.2; color: var(--text-muted); text-align: center; overflow-wrap: anywhere; }
    .notice { margin: 8px 0 0; min-height: 16px; color: var(--text-muted); font-size: 12px; }
  `,
})
export class AssistedInput implements OnDestroy {
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
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) {
      return;
    }
    event.preventDefault();
    this.send();
  }

  protected send(): void {
    if (this.canSend()) {
      this.submitted.emit(this.draft());
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
