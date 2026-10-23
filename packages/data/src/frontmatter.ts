/**
 * Sottoinsieme YAML flat per il frontmatter Markdown: `chiave: valore` con
 * stringhe, numeri, booleani e null. Nessun annidamento, lista o multilinea.
 */
export type FrontmatterScalar = string | number | boolean | null;
export type FrontmatterData = Record<string, FrontmatterScalar>;

export type FrontmatterErrorCode =
  | 'FRONTMATTER_UNTERMINATED'
  | 'FRONTMATTER_INVALID_LINE'
  | 'FRONTMATTER_INVALID_KEY'
  | 'FRONTMATTER_DUPLICATE_KEY'
  | 'FRONTMATTER_INVALID_VALUE'
  | 'FRONTMATTER_UNKNOWN_FIELD';

export class FrontmatterError extends Error {
  constructor(
    readonly code: FrontmatterErrorCode,
    detail?: string,
  ) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = 'FrontmatterError';
  }
}

export interface ParsedFrontmatter {
  readonly hasFrontmatter: boolean;
  readonly data: FrontmatterData;
  readonly body: string;
}

const DELIMITER = '---';
const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PLAIN_STRING_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_./@+-]*$/;
const NUMBER_PATTERN = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const RESERVED_PLAIN = new Set(['true', 'false', 'null', '~', 'yes', 'no', 'on', 'off']);

export function formatFrontmatterValue(value: FrontmatterScalar): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new FrontmatterError('FRONTMATTER_INVALID_VALUE', 'numero non finito');
    }
    return String(value);
  }
  if (
    PLAIN_STRING_PATTERN.test(value) &&
    !NUMBER_PATTERN.test(value) &&
    !RESERVED_PLAIN.has(value.toLowerCase())
  ) {
    return value;
  }
  // Una stringa JSON è anche una stringa YAML double-quoted valida.
  return JSON.stringify(value);
}

function parseFrontmatterValue(raw: string): FrontmatterScalar {
  const text = raw.trim();
  if (text === 'null' || text === '~' || text === '') {
    return null;
  }
  if (text === 'true') {
    return true;
  }
  if (text === 'false') {
    return false;
  }
  if (NUMBER_PATTERN.test(text)) {
    return Number(text);
  }
  if (text.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === 'string') {
        return parsed;
      }
    } catch {
      // gestito sotto
    }
    throw new FrontmatterError('FRONTMATTER_INVALID_VALUE', 'stringa double-quoted non valida');
  }
  if (text.startsWith("'")) {
    if (text.length < 2 || !text.endsWith("'") || text.slice(1, -1).replace(/''/g, '').includes("'")) {
      throw new FrontmatterError('FRONTMATTER_INVALID_VALUE', 'stringa single-quoted non valida');
    }
    return text.slice(1, -1).replace(/''/g, "'");
  }
  if (/^[[{|>&*!%@`]/.test(text) || / #/.test(text) || text.includes(': ')) {
    throw new FrontmatterError('FRONTMATTER_INVALID_VALUE', 'valore non supportato');
  }
  return text;
}

/** Legge frontmatter e body. Un file senza `---` iniziale restituisce `hasFrontmatter: false` e il testo intero come body. */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  const text = content.startsWith('\uFEFF') ? content.slice(1) : content;
  const lines = text.split('\n');
  if (lines[0]?.trimEnd() !== DELIMITER) {
    return { hasFrontmatter: false, data: {}, body: content };
  }
  const closing = lines.findIndex((line, index) => index > 0 && line.trimEnd() === DELIMITER);
  if (closing < 0) {
    throw new FrontmatterError('FRONTMATTER_UNTERMINATED');
  }
  const data: FrontmatterData = {};
  for (const line of lines.slice(1, closing)) {
    const cleaned = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (cleaned.trim() === '' || cleaned.trimStart().startsWith('#')) {
      continue;
    }
    const separator = cleaned.indexOf(':');
    if (separator < 0 || /^\s/.test(cleaned)) {
      throw new FrontmatterError('FRONTMATTER_INVALID_LINE');
    }
    const key = cleaned.slice(0, separator);
    if (!KEY_PATTERN.test(key)) {
      throw new FrontmatterError('FRONTMATTER_INVALID_KEY', key);
    }
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      throw new FrontmatterError('FRONTMATTER_DUPLICATE_KEY', key);
    }
    Object.defineProperty(data, key, {
      value: parseFrontmatterValue(cleaned.slice(separator + 1)),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return { hasFrontmatter: true, data, body: lines.slice(closing + 1).join('\n') };
}

export function serializeFrontmatter(data: FrontmatterData, body = ''): string {
  const lines = Object.entries(data).map(([key, value]) => {
    if (!KEY_PATTERN.test(key)) {
      throw new FrontmatterError('FRONTMATTER_INVALID_KEY', key);
    }
    return `${key}: ${formatFrontmatterValue(value)}`;
  });
  return `${DELIMITER}\n${lines.join('\n')}${lines.length > 0 ? '\n' : ''}${DELIMITER}\n${body}`;
}

/**
 * Separa i campi noti da quelli sconosciuti. Con `reject` un campo sconosciuto
 * lancia; con `preserve` viene restituito in `extra` per essere riscritto.
 */
export function splitKnownFields(
  data: FrontmatterData,
  knownKeys: readonly string[],
  policy: 'preserve' | 'reject',
): { known: FrontmatterData; extra: FrontmatterData } {
  const known: FrontmatterData = {};
  const extra: FrontmatterData = {};
  for (const [key, value] of Object.entries(data)) {
    if (knownKeys.includes(key)) {
      known[key] = value;
    } else if (policy === 'reject') {
      throw new FrontmatterError('FRONTMATTER_UNKNOWN_FIELD', key);
    } else {
      extra[key] = value;
    }
  }
  return { known, extra };
}
