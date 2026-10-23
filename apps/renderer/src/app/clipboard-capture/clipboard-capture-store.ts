import { Injectable, signal } from '@angular/core';
import type { ClipboardCaptureState, ClipboardConfigureRequest, SmartTerminalApi } from '@smart-terminal/contracts';

/** Stato (sintetico) della cattura clipboard opt-in; la fonte di verita' e' il main process. */
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

  /** Comunica al main la sessione attiva (cambio tab, focus finestra). */
  syncActive(sessionId: string | null): void {
    this.lastActiveId = sessionId;
    void this.run(() => this.api.clipboardSetActive({ sessionId }));
  }

  /** Riallinea sessione attiva e stato (es. al focus della finestra). */
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
