import { Injectable } from '@angular/core';

const MAX_CONSOLE_LINES = 200;
const MAX_CONSOLE_CHARACTERS = 8000;

@Injectable({ providedIn: 'root' })
export class TerminalConsole {
  private readonly readers = new Map<string, () => string | null>();

  register(sessionId: string, reader: () => string | null): void {
    this.readers.set(sessionId, reader);
  }

  unregister(sessionId: string): void {
    this.readers.delete(sessionId);
  }

  read(sessionId: string | null): string {
    if (sessionId === null) return '';
    const output = this.readers.get(sessionId)?.();
    if (!output) return '';
    return formatConsoleText(output.split('\n'));
  }
}

export function formatConsoleText(lines: string[]): string {
  let boundedLines = lines.slice();
  while (boundedLines.length > 0 && boundedLines[boundedLines.length - 1] === '') {
    boundedLines.pop();
  }
  boundedLines = boundedLines.slice(-MAX_CONSOLE_LINES);
  const text = boundedLines
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
  const characters = Array.from(text);
  return characters.length > MAX_CONSOLE_CHARACTERS
    ? characters.slice(-MAX_CONSOLE_CHARACTERS).join('')
    : text;
}
