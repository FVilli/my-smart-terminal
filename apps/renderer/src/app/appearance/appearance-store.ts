import { Injectable, computed, signal } from '@angular/core';
import { TERMINAL_FONTS, type TerminalFontId } from '@smart-terminal/contracts';

@Injectable({ providedIn: 'root' })
export class AppearanceStore {
  private readonly fontIdState = signal<TerminalFontId>('jetbrains');
  readonly fontId = this.fontIdState.asReadonly();
  readonly fontStack = computed(() => TERMINAL_FONTS.find((font) => font.id === this.fontIdState())?.stack ?? TERMINAL_FONTS[0].stack);

  constructor() {
    this.applyFont();
  }

  set(fontId: TerminalFontId): void {
    this.fontIdState.set(fontId);
    this.applyFont();
  }

  private applyFont(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--font-mono', this.fontStack());
    }
  }
}
