import { Injectable, signal } from '@angular/core';
import type { ClipboardCaptureState, ClipboardConfigureRequest, SmartTerminalApi } from '@smart-terminal/contracts';

/** (Synthetic) opt-in clipboard capture state; the main process is the source of truth. */
@Injectable({ providedIn: 'root' })
export class ClipboardCaptureStore {
  private readonly api: SmartTerminalApi = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  private readonly stateSignal = signal<ClipboardCaptureState>({ enabled: false, paused: false, lastEventAt: null });
  private readonly errorSignal = signal(false);
  private lastActiveId: string | null = null;

  readonly state = this.stateSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  constructor() {
    void this.run(() => this.api.clipboardState());
  }

  configure(request: ClipboardConfigureRequest): void {
    void this.run(() => this.api.clipboardConfigure(request));
  }

  clearDedupe(): void {
    void this.run(() => this.api.clipboardClear());
  }

  /** Notifies the main process of the active session (tab change, window focus). */
  syncActive(sessionId: string | null): void {
    this.lastActiveId = sessionId;
    void this.run(() => this.api.clipboardSetActive({ sessionId }));
  }

  /** Resynchronizes the active session and state (for example, on window focus). */
  refresh(): void {
    this.syncActive(this.lastActiveId);
  }

  private async run(call: () => Promise<ClipboardCaptureState>): Promise<void> {
    try {
      this.stateSignal.set(await call());
      this.errorSignal.set(false);
    } catch {
      this.errorSignal.set(true);
    }
  }
}
