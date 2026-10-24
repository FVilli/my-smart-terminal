import { Injectable, signal } from '@angular/core';
import type { SidebarTab } from './session.model';

@Injectable({ providedIn: 'root' })
export class LayoutStore {
  private readonly panelState = signal<SidebarTab | null>('clipboard');
  readonly panel = this.panelState.asReadonly();

  set(tab: SidebarTab | null): void {
    this.panelState.set(tab);
  }

  toggle(tab: SidebarTab): void {
    this.panelState.update((active) => active === tab ? null : tab);
  }
}
