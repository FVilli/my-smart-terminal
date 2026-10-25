import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { renderMarkdown } from './markdown.logic';

@Component({
  selector: 'app-markdown-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-none items-center justify-between gap-1" role="group" aria-label="Answer view">
      @if (label()) { <span class="form-label">{{ label() }}</span> } @else { <span></span> }
      <div class="flex items-center gap-1">
      <button type="button" class="btn px-2 py-0.5 text-[11px]" data-testid="ai-answer-view-rendered" [attr.aria-pressed]="mode() === 'rendered'" (click)="setMode('rendered')">Rendered</button>
      <button type="button" class="btn px-2 py-0.5 text-[11px]" data-testid="ai-answer-view-raw" [attr.aria-pressed]="mode() === 'raw'" (click)="setMode('raw')">Raw</button>
      </div>
    </div>
    <div
      data-testid="ai-answer-rendered"
      class="markdown-body min-h-0 flex-1 overflow-auto rounded border border-line bg-input p-2"
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
