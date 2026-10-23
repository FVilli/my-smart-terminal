export interface TerminalCopyKeyEvent {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey?: boolean;
  metaKey: boolean;
}

export function isTerminalCopyShortcut(event: TerminalCopyKeyEvent): boolean {
  if (event.altKey) return false;
  return (event.key.toLowerCase() === 'c' && (event.metaKey || (event.ctrlKey && event.shiftKey))) ||
    (event.key === 'Insert' && event.ctrlKey && !event.metaKey);
}

export async function copyTerminalSelection(
  selection: string,
  clipboardWrite: (value: { text: string }) => Promise<void>,
): Promise<boolean> {
  if (selection.length === 0) return false;
  try {
    await clipboardWrite({ text: selection });
  } catch {
    // Clipboard failures must not affect terminal input.
  }
  return true;
}
