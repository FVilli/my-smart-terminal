import { ChangeDetectionStrategy, Component, effect, HostListener, Injectable, inject, signal, viewChild, type ElementRef } from '@angular/core';
import { AiActionsSettings } from './ai-actions-settings';

@Injectable({ providedIn: 'root' })
export class AiActionsManagerStore {
  readonly open = signal(false);
  show(): void { this.open.set(true); }
  close(): void { this.open.set(false); }
}

@Component({
  selector: 'app-ai-actions-manager',
  standalone: true,
  imports: [AiActionsSettings],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (manager.open()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4" (click)="backdrop($event)">
        <section #dialog class="flex max-h-[min(720px,90vh)] min-h-0 w-[min(1000px,94vw)] flex-col overflow-hidden rounded-[10px] border border-line bg-surface shadow" role="dialog" aria-modal="true" aria-labelledby="ai-actions-title">
          <header class="flex-none border-b border-line px-5 py-4">
            <h2 id="ai-actions-title" class="text-lg font-semibold">AI actions</h2>
            <p class="text-sm text-muted">Manage the actions available to your AI assistant.</p>
          </header>
          <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-5"><app-ai-actions-settings /></div>
          <footer class="flex flex-none justify-end border-t border-line p-4"><button type="button" class="btn px-3" data-testid="ai-actions-close" (click)="close()">Close</button></footer>
        </section>
      </div>
    }
  `,
})
export class AiActionsManager {
  protected readonly manager = inject(AiActionsManagerStore);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  constructor() {
    effect(() => { if (this.manager.open()) this.focusFirst(); });
  }

  private focusFirst(): void {
    queueMicrotask(() => this.focusable()[0]?.focus());
  }

  private focusable(): HTMLElement[] {
    return Array.from(this.dialog()?.nativeElement.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
  }

  protected close(): void {
    this.manager.close();
    queueMicrotask(() => document.querySelector<HTMLElement>('[data-testid="ai-actions-open"]')?.focus());
  }
  protected backdrop(event: MouseEvent): void { if (event.target === event.currentTarget) this.close(); }

  @HostListener('document:keydown', ['$event'])
  protected keydown(event: KeyboardEvent): void {
    if (!this.manager.open()) return;
    if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
    if (event.key === 'Tab') {
      const controls = this.focusable();
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !this.dialog()?.nativeElement.contains(document.activeElement))) { event.preventDefault(); last!.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !this.dialog()?.nativeElement.contains(document.activeElement))) { event.preventDefault(); first!.focus(); }
    }
  }
}
