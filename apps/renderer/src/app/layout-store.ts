import { Injectable, signal } from '@angular/core';
import type { SidebarTab } from './session.model';

@Injectable({ providedIn: 'root' })
export class LayoutStore {
  private readonly panelState = signal<SidebarTab | null>('clipboard');
  private lastPanel: SidebarTab = 'clipboard';
  readonly panel = this.panelState.asReadonly();

  set(tab: SidebarTab | null): void {
    if (tab !== null) this.lastPanel = tab;
    this.panelState.set(tab);
  }

  toggle(): void {
    this.panelState.update((active) => {
      if (active !== null) return null;
      return this.lastPanel;
    });
  }
}
