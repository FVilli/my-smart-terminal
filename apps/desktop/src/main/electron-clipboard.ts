import { clipboard } from 'electron';
import type { ClipboardTextSource } from '@smart-terminal/data';

/** Adapter sulla clipboard di sistema di Electron (solo testo). */
export const electronClipboardSource: ClipboardTextSource = {
  readText: () => clipboard.readText(),
};
