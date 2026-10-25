import type { TerminalTheme } from '@smart-terminal/contracts';

export interface TerminalPalette {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string; red: string; green: string; yellow: string;
  blue: string; magenta: string; cyan: string; white: string;
  brightBlack: string; brightRed: string; brightGreen: string; brightYellow: string;
  brightBlue: string; brightMagenta: string; brightCyan: string; brightWhite: string;
}

// Dark palette intentionally preserves the prior defaults exactly, including xterm ANSI defaults.
export const TERMINAL_PALETTES: Record<TerminalTheme, TerminalPalette> = {
  dark: {
    background: '#171e25', foreground: '#e6edf3', cursor: '#4cc2a5', selectionBackground: '#2c3a4a',
    black: '#2e3436', red: '#cc0000', green: '#4e9a06', yellow: '#c4a000', blue: '#3465a4', magenta: '#75507b', cyan: '#06989a', white: '#d3d7cf',
    brightBlack: '#555753', brightRed: '#ef2929', brightGreen: '#8ae234', brightYellow: '#fce94f', brightBlue: '#729fcf', brightMagenta: '#ad7fa8', brightCyan: '#34e2e2', brightWhite: '#eeeeec',
  },
  light: {
    background: '#ffffff', foreground: '#18212b', cursor: '#006b57', selectionBackground: '#b8d9d0',
    black: '#18212b', red: '#b42318', green: '#176b3a', yellow: '#805400', blue: '#1857a4', magenta: '#7a3e75', cyan: '#006b70', white: '#526170',
    brightBlack: '#526170', brightRed: '#8f1d14', brightGreen: '#14532d', brightYellow: '#684500', brightBlue: '#12427d', brightMagenta: '#653260', brightCyan: '#00545a', brightWhite: '#18212b',
  },
};

export function terminalPalette(theme: TerminalTheme): TerminalPalette {
  return TERMINAL_PALETTES[theme];
}
