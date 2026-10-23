import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { AiStore, correctionNotice } from '../ai/ai-store';

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
        [attr.title]="ai.status().warning ?? 'Correggi i refusi con AI'"
        (click)="correctWithAi()"
      >
        {{ ai.busy() ? '…' : 'AI' }}
      </button>
      <textarea
        class="editor"
        data-testid="assisted-textarea"
        rows="3"
        spellcheck="false"
        placeholder="Invio invia · Shift+Invio va a capo"
        aria-label="Input assistito"
        [value]="draft()"
        [disabled]="disabled()"
        (input)="draftChange.emit($any($event.target).value)"
        (keydown)="onKeydown($event)"
      ></textarea>
      <button type="button" class="icon send" data-testid="assisted-send" aria-label="Invia" [disabled]="!canSend()" (click)="send()">⏎</button>
      <div class="voice">
        <button type="button" class="icon" data-testid="assisted-mic" aria-label="Microfono" disabled>🎤</button>
        <span class="voice-label">Voice ready</span>
      </div>
    </div>
    @if (notice(); as message) {
      <p class="notice" data-testid="ai-notice">{{ message }}</p>
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
    .voice { display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 4px; }
    .voice .icon { flex: 1; }
    .voice-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
    .notice { margin: 8px 0 0; min-height: 16px; color: var(--text-muted); font-size: 12px; }
  `,
})
export class AssistedInput {
  readonly draft = input('');
  /** Sessione attiva assente o non running: editing e invio bloccati. */
  readonly disabled = input(false);
  readonly draftChange = output<string>();
  readonly submitted = output<string>();
  private readonly ai = inject(AiStore);
  protected readonly notice = signal<string | null>(null);
  protected readonly canSend = computed(() => !this.disabled() && this.draft().trim().length > 0);
  protected readonly canCorrect = computed(() => this.ai.canCorrect() && this.draft().trim().length > 0);

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
