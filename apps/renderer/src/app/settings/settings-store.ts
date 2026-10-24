import { Injectable, signal } from '@angular/core';

/** Opens the onboarding wizard in edit mode from the application shell. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly openState = signal(false);
  private readonly initialTabState = signal<'repository' | 'ai' | 'stt' | 'appearance'>('repository');

  readonly open = this.openState.asReadonly();
  readonly initialTab = this.initialTabState.asReadonly();

  takeInitialTab(): 'repository' | 'ai' | 'stt' | 'appearance' {
    const tab = this.initialTabState();
    this.initialTabState.set('repository');
    return tab;
  }

  openSettings(tab: 'repository' | 'ai' | 'stt' | 'appearance' = 'repository'): void {
    this.initialTabState.set(tab);
    this.openState.set(true);
  }

  close(): void {
    this.openState.set(false);
  }
}
