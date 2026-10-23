import { Injectable, computed, signal } from '@angular/core';
import type { AiStatus, CorrectionResult, SmartTerminalApi } from '@smart-terminal/contracts';

/** Stato della correzione AI nel renderer: il token e le chiamate provider restano nel main. */
@Injectable({ providedIn: 'root' })
export class AiStore {
  private readonly api: SmartTerminalApi = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  private readonly statusState = signal<AiStatus>({
    configured: false,
    provider: 'none',
    hasToken: false,
    secureStorage: false,
  });
  private readonly busyState = signal(false);

  readonly status = this.statusState.asReadonly();
  readonly busy = this.busyState.asReadonly();
  readonly canCorrect = computed(() => this.statusState().configured && !this.busyState());

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.statusState.set(await this.api.aiStatus());
    } catch {
      this.statusState.set({ configured: false, provider: 'none', hasToken: false, secureStorage: false });
    }
  }

  async correct(text: string): Promise<CorrectionResult | null> {
    if (!this.canCorrect() || text.trim().length === 0) {
      return null;
    }
    this.busyState.set(true);
    try {
      return await this.api.aiCorrect({ text });
    } catch {
      return {
        original: text,
        corrected: text,
        changed: false,
        skipped: true,
        reason: 'provider-error',
      };
    } finally {
      this.busyState.set(false);
    }
  }
}

export function correctionNotice(result: CorrectionResult): string {
  if (!result.skipped) {
    return 'Correzione AI applicata: rivedi prima di inviare.';
  }
  switch (result.reason) {
    case 'shell':
      return 'Il testo sembra un comando shell: correzione AI non applicata.';
    case 'missing-token':
      return 'Token AI mancante: configura il provider nelle impostazioni.';
    case 'unconfigured':
      return 'Provider AI non configurato.';
    case 'timeout':
      return 'AI non disponibile (timeout): testo originale mantenuto.';
    case 'empty':
      return 'Nessuna correzione necessaria.';
    default:
      return 'AI non disponibile: testo originale mantenuto.';
  }
}
