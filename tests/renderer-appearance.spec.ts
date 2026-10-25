import { describe, expect, it } from 'vitest';
import { terminalPalette } from '../apps/renderer/src/app/appearance/terminal-theme';

describe('terminal palettes', () => {
  it('preserves the previous dark appearance and complete ANSI defaults', () => {
    expect(terminalPalette('dark')).toEqual({
      background: '#171e25', foreground: '#e6edf3', cursor: '#4cc2a5', selectionBackground: '#2c3a4a',
      black: '#2e3436', red: '#cc0000', green: '#4e9a06', yellow: '#c4a000', blue: '#3465a4', magenta: '#75507b', cyan: '#06989a', white: '#d3d7cf',
      brightBlack: '#555753', brightRed: '#ef2929', brightGreen: '#8ae234', brightYellow: '#fce94f', brightBlue: '#729fcf', brightMagenta: '#ad7fa8', brightCyan: '#34e2e2', brightWhite: '#eeeeec',
    });
  });
  it('provides a complete light palette', () => {
    expect(Object.keys(terminalPalette('light'))).toHaveLength(20);
  });
});
