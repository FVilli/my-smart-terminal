import { Injectable, signal } from '@angular/core';

/** Opens the onboarding wizard in edit mode from the application shell. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly openState = signal(false);

  readonly open = this.openState.asReadonly();

  openSettings(): void {
    this.openState.set(true);
  }

  close(): void {
    this.openState.set(false);
  }
}
