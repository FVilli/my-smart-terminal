import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { renderMarkdown } from './markdown.logic';

@Component({
  selector: 'app-markdown-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-none items-center justify-between gap-1" role="group" aria-label="Answer view">
      @if (label()) { <span class="text-sm">{{ label() }}</span> } @else { <span></span> }
      <div class="flex items-center gap-1">
      <button type="button" class="btn px-2 py-0.5 text-[11px]" data-testid="ai-answer-view-rendered" [attr.aria-pressed]="mode() === 'rendered'" (click)="setMode('rendered')">Rendered</button>
      <button type="button" class="btn px-2 py-0.5 text-[11px]" data-testid="ai-answer-view-raw" [attr.aria-pressed]="mode() === 'raw'" (click)="setMode('raw')">Raw</button>
      </div>
    </div>
    <div
      data-testid="ai-answer-rendered"
      class="markdown min-h-0 flex-1 overflow-auto rounded border border-line bg-input p-2"
      [class.hidden]="mode() === 'raw'"
      [innerHTML]="html()"
      (mouseup)="captureRendered($event)"
      (keyup)="captureRendered($event)"
    ></div>
    <textarea
      readonly
      aria-label="AI answer raw"
      data-testid="ai-answer"
      class="min-h-0 flex-1 resize-none overflow-auto rounded border border-line bg-input p-2 font-mono"
      [class.hidden]="mode() === 'rendered'"
      [value]="text()"
      (select)="captureRaw($event)"
    ></textarea>
  `,
  styles: [`
    :host { display: flex; min-height: 0; flex-direction: column; gap: 0.5rem; }
    .markdown :where(h1,h2,h3,h4,h5,h6) { margin: .5em 0; font-weight: 600; color: var(--text); }
    .markdown :where(ul,ol) { padding-left: 1.5em; color: var(--text); }
    .markdown ul { list-style: disc; }
    .markdown ol { list-style: decimal; }
    .markdown pre, .markdown code { border: 1px solid var(--border); background: var(--card-bg); color: var(--text); font-family: var(--font-code), monospace; }
    .markdown pre { padding: .5em; overflow: auto; }
    .markdown blockquote { border-left: 2px solid var(--border); padding-left: .75em; color: var(--text-muted); }
    .markdown p { margin: .4em 0; }
    .markdown a { color: var(--accent); text-decoration: underline; }
  `],
})
export class MarkdownView {
  readonly text = input('');
  readonly label = input('');
  readonly selectionChange = output<string>();
  readonly mode = signal<'rendered' | 'raw'>('rendered');

  html(): string { return renderMarkdown(this.text()); }

  setMode(mode: 'rendered' | 'raw'): void {
    this.mode.set(mode);
    this.selectionChange.emit('');
  }

  captureRendered(event: Event): void {
    const container = event.currentTarget as HTMLElement;
    const selection = window.getSelection();
    const inside = selection !== null
      && (selection.anchorNode === container || container.contains(selection.anchorNode))
      && (selection.focusNode === container || container.contains(selection.focusNode));
    this.selectionChange.emit(inside ? selection.toString() : '');
  }

  captureRaw(event: Event): void {
    const area = event.target as HTMLTextAreaElement;
    this.selectionChange.emit(area.selectionStart !== area.selectionEnd ? area.value.slice(area.selectionStart, area.selectionEnd) : '');
  }
}
