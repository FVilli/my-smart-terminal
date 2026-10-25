export interface InsertAtSelectionOptions {
  /** Pad with spaces so adjacent words do not glue (speech transcripts); AI answers insert verbatim. */
  padWords?: boolean;
  /** Refuse insertions that would exceed this many characters. */
  maxLength?: number;
}

/**
 * Pure insertion helper shared by the STT transcript and the AI `Use` action.
 * Returns the new value and caret position, or null when there is nothing to insert
 * (or the result would exceed `maxLength`).
 */
export function insertAtSelection(
  value: string,
  text: string,
  start: number,
  end: number,
  options: InsertAtSelectionOptions = {},
): { value: string; caret: number } | null {
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  const normalized = text.replace(/\r\n?/g, '\n');
  if (normalized.trim().length === 0) return null;
  const before = value.slice(0, from);
  const after = value.slice(to);
  const pad = options.padWords === true;
  const prefix = pad && before.length > 0 && !/\s$/.test(before) ? ' ' : '';
  const suffix = pad && after.length > 0 && !/^\s/.test(after) ? ' ' : '';
  const next = `${before}${prefix}${normalized}${suffix}${after}`;
  if (options.maxLength !== undefined && next.length > options.maxLength) return null;
  return { value: next, caret: before.length + prefix.length + normalized.length };
}
