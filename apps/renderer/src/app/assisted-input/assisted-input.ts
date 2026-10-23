import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-assisted-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <button type="button" class="icon ai" data-testid="ai-correction" aria-label="AI correction" disabled>AI</button>
      <textarea
        class="editor"
        data-testid="assisted-textarea"
        rows="3"
        spellcheck="false"
        placeholder="Scrivi un comando o una richiesta…"
        aria-label="Input assistito"
        [value]="draft()"
        [disabled]="disabled()"
        (input)="draftChange.emit($any($event.target).value)"
      ></textarea>
      <button type="button" class="icon send" data-testid="assisted-send" aria-label="Invia" disabled>⏎</button>
      <div class="voice">
        <button type="button" class="icon" data-testid="assisted-mic" aria-label="Microfono" disabled>🎤</button>
        <span class="voice-label">Voice ready</span>
      </div>
    </div>
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
  `,
})
export class AssistedInput {
  readonly draft = input('');
  readonly disabled = input(false);
  readonly draftChange = output<string>();
  readonly submitted = output<string>();
}
