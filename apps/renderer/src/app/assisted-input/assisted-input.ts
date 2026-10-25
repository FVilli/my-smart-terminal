import { ChangeDetectionStrategy, Component, HostListener, type ElementRef, type OnDestroy, computed, effect, inject, input, output, viewChild } from '@angular/core';
import { AiStore } from '../ai/ai-store';
import { AiActionsStore } from '../ai/ai-actions-store';
import { insertAtSelection } from './insert-at-selection';
import { SttStore, voiceLabel } from '../stt/stt-store';
import { SettingsStore } from '../settings/settings-store';
import { AppearanceStore } from '../appearance/appearance-store';
import { MessageStore } from '../messages/message-store';

@Component({
  selector: 'app-assisted-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block flex-none border-t border-line bg-terminal px-4 py-2' },
  template: `
    <div class="composer flex h-composer min-h-composer items-stretch gap-2 rounded-lg border border-line-soft bg-input py-[5px] pr-[6px] pl-2 focus-within:border-accent focus-within:shadow-[0_0_0_1px_var(--focus-ring)]">
      <textarea
        class="editor block h-full w-full min-w-0 min-h-0 flex-1 resize-none border-0 bg-transparent p-0 px-[4px] py-[2px] pl-[2px] text-sm leading-[1.5] text-fg outline-0 font-mono overflow-y-auto overflow-x-hidden placeholder:text-muted disabled:opacity-[0.65]"
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
      <div class="actions flex w-[30px] flex-none flex-col items-center justify-center gap-[7px] min-w-0">
      <button
        type="button"
        class="icon ai icon-btn h-[26px] w-[28px] p-0 text-accent"
        data-testid="ai-correction"
        aria-label="AI actions"
        [attr.title]="ai.status().warning ?? 'Open AI actions'"
        (click)="openAiActions()"
      >
        @if (ai.busy()) { … } @else { <svg class="h-[15px] w-[15px]" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5 12 7l5.5 2-5.5 2-2 5.5L8 11 2.5 9 8 7z" fill="currentColor"/><path d="m16 13 .9 2.1L19 16l-2.1.9L16 19l-.9-2.1L13 16l2.1-.9z" fill="currentColor"/></svg> }
      </button>
      <div class="voice flex flex-col items-center gap-[2px]">
        <button
          type="button"
          class="icon mic icon-btn h-[26px] w-[28px] p-0"
          data-testid="assisted-mic"
          [attr.aria-label]="micLabel()"
          [attr.aria-pressed]="voice.phase() === 'recording'"
          [class.listening]="voice.phase() === 'recording'"
          [class.text-fg]="voice.status().configured"
          [attr.title]="voice.notice() ?? voice.status().warning ?? (voice.phase() === 'recording' ? 'Stop recording' : 'Start dictation')"
          (click)="toggleRecording($event)"
        >
          <svg class="h-[17px] w-[17px]" viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="2" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3m-3 0h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        </button>
        <span class="voice-label sr-only" data-testid="voice-label" role="status">{{ voice.status().configured ? micLabel() : '' }}</span>
      </div>
      <button type="button" class="icon send icon-btn h-[26px] w-[26px] rounded-full bg-accent p-0 text-[15px] font-bold text-terminal disabled:opacity-45" data-testid="assisted-send" aria-label="Send" [disabled]="!canSend()" (click)="send()"><svg class="h-[17px] w-[17px]" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4m-5 5 5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
    </div>
  `,
  styles: `
    .editor { font-variant-ligatures: none; font-feature-settings: "liga" 0; letter-spacing: 0; scrollbar-gutter: stable; }
    .editor::placeholder { opacity: 1; }
    .mic.listening { animation: mic-pulse 2s ease-in-out infinite; }
    @keyframes mic-pulse {
      0%, 100% { color: var(--record); opacity: 1; filter: drop-shadow(0 0 0 transparent); }
      50% { color: var(--record-strong); opacity: 0.35; filter: drop-shadow(0 0 4px color-mix(in srgb, var(--record) 70%, transparent)); }
    }
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
  private readonly aiActions = inject(AiActionsStore);
  protected readonly canRecord = computed(() => !this.disabled() && this.voice.status().configured);
  protected readonly micLabel = computed(() => voiceLabel(this.voice.status(), this.voice.phase(), this.voice.error()));
  private readonly unsubscribe: () => void;

  constructor() {
    this.unsubscribe = this.voice.onTranscript((text) => this.insertTranscript(text));
    effect(() => {
      const pending = this.aiActions.pendingInsert();
      if (pending === null) return;
      this.aiActions.consumeInsert();
      if (pending.length > 100_000) {
        this.messages.show('warning', 'The AI answer is too long to insert.');
        return;
      }
      this.insertAtCaret(pending, false);
    });
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

  protected openSttSettings(): void {
    this.settings.openSettings('stt');
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
    this.insertAtCaret(text.trim(), true);
  }

  /**
   * Inserts text at the current caret/selection. Shared by dictated transcripts (word padding)
   * and the AI `Use` action (verbatim). Never submits the draft.
   */
  private insertAtCaret(text: string, padWords: boolean): void {
    const value = this.draft();
    const element = this.textarea().nativeElement;
    const start = element.selectionStart ?? value.length;
    const end = element.selectionEnd ?? start;
    const result = insertAtSelection(value, text, start, end, { padWords });
    if (result === null) return;
    this.draftChange.emit(result.value);
    queueMicrotask(() => {
      element.focus();
      element.setSelectionRange(result.caret, result.caret);
    });
  }

  protected openAiActions(): void { void this.aiActions.show(); }
}
