import { Injectable, computed, signal } from '@angular/core';
import { TERMINAL_FONTS, type TerminalFontId, type TerminalTheme } from '@smart-terminal/contracts';

@Injectable({ providedIn: 'root' })
export class AppearanceStore {
  private readonly fontIdState = signal<TerminalFontId>('jetbrains');
  private readonly themeState = signal<TerminalTheme>('dark');
  readonly theme = this.themeState.asReadonly();
  readonly terminalTheme = computed(() => this.themeState());
  readonly fontId = this.fontIdState.asReadonly();
  readonly fontStack = computed(() => TERMINAL_FONTS.find((font) => font.id === this.fontIdState())?.stack ?? TERMINAL_FONTS[0].stack);

  constructor() {
    this.applyFont();
  }

  setTheme(theme: TerminalTheme): void {
    this.themeState.set(theme);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset['theme'] = theme;
      document.documentElement.style.colorScheme = theme;
    }
  }

  set(fontId: TerminalFontId): void {
    this.fontIdState.set(fontId);
    this.applyFont();
  }

  private applyFont(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--font-code', this.fontStack());
    }
  }
}
