import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { nextTabIndex, type TabItem } from './tabs.logic';

@Component({
  selector: 'app-tabs-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="tablist" [attr.aria-label]="label()" class="flex border-b border-line">
      @for (tab of tabs(); track tab.id) {
        <button type="button" role="tab" [id]="tabId(tab.id)" [attr.data-testid]="tab.testId"
          [attr.aria-selected]="activeId() === tab.id"
          [disabled]="tab.disabled" [tabIndex]="activeId() === tab.id ? 0 : -1"
          class="cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-3 py-2 text-sm text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          [class.text-fg]="activeId() === tab.id" [class.shadow-tab-active]="activeId() === tab.id"
          (click)="selected.emit(tab.id)" (keydown)="onKeydown($event, tab.id)">{{ tab.label }}</button>
      }
    </div>
    <ng-content />
  `,
})
export class TabsContainer {
  readonly label = input('Tabs');
  readonly tabs = input.required<readonly TabItem[]>();
  readonly activeId = input.required<string>();
  readonly selected = output<string>();
  tabId(id: string): string { return `tab-${id}`; }
  panelId(id: string): string { return `panel-${id}`; }

  onKeydown(event: KeyboardEvent, id: string): void {
    const enabled = this.tabs().filter((tab) => !tab.disabled);
    const index = enabled.findIndex((tab) => tab.id === id);
    const moveKey = event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Home' || event.key === 'End';
    if (!moveKey) return;
    event.preventDefault();
    const next = nextTabIndex(index, enabled.length, event.key);
    const targetTab = enabled[next];
    if (next >= 0 && targetTab) {
      (event.currentTarget as HTMLElement | null)?.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[this.tabIndexFor(targetTab.id)]?.focus();
      this.selected.emit(targetTab.id);
    }
  }

  private tabIndexFor(id: string): number {
    return this.tabs().findIndex((tab) => tab.id === id);
  }
}
