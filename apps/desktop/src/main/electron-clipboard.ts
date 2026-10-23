import { clipboard } from 'electron';
import type { ClipboardTextSource } from '@smart-terminal/data';

/** Adapter for Electron's system clipboard (text only). */
export const electronClipboardSource: ClipboardTextSource = {
  readText: () => clipboard.readText(),
};
