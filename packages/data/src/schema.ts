import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  FrontmatterError,
  parseFrontmatter,
  serializeFrontmatter,
  splitKnownFields,
  type FrontmatterData,
  type FrontmatterScalar,
} from './frontmatter';
import { isIsoTimestamp, isValidMachine, parseSessionLabel } from './paths';

/**
 * Current Markdown frontmatter version. Readers must reject other versions with
 * SCHEMA_INVALID_VERSION instead of guessing; a future bump requires an explicit
 * migration that preserves existing synchronized files.
 */
export const SCHEMA_VERSION = 1;

export type SchemaErrorCode =
  | 'SCHEMA_MISSING_FRONTMATTER'
  | 'SCHEMA_INVALID_VERSION'
  | 'SCHEMA_INVALID_FIELD'
  | 'SCHEMA_MISSING_FIELD'
  | 'SCHEMA_INVALID_EVENT'
  | 'SCHEMA_INVALID_DOCUMENT';

export class SchemaError extends Error {
  constructor(
    readonly code: SchemaErrorCode,
    detail?: string,
  ) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = 'SchemaError';
  }
}

export type UnknownFieldPolicy = 'preserve' | 'reject';
export interface ParseOptions {
  /** `preserve` (default) conserva i campi sconosciuti in `extraFields`; `reject` lancia. */
  unknownFields?: UnknownFieldPolicy;
}

export type SessionKind = 'local' | 'ssh';

export interface SessionMeta {
  schema_version: 1;
  session_id: string;
  machine: string;
  created_at: string;
  window_id: string;
  kind: SessionKind;
  ssh_alias?: string;
  cwd_initial: string;
  started_at: string;
  ended_at?: string;
  os?: 'linux' | 'macos' | 'windows' | 'unknown';
  shell?: 'bash' | 'zsh' | 'fish' | 'sh' | 'pwsh' | 'powershell' | 'cmd' | 'unknown';
  env_source?: 'local' | 'ssh-probe' | 'unknown';
  env_detected_at?: string;
}

export interface SessionDocument {
  meta: SessionMeta;
  extraFields: FrontmatterData;
  body: string;
}

export type HistorySource = 'shell' | 'assisted';

export interface HistoryEvent {
  id: string;
  timestamp: string;
  source: HistorySource;
  agent?: string;
  cwd?: string;
  text: string;
}

export interface ClipboardEvent {
  id: string;
  timestamp: string;
  type: 'text';
  source?: string;
  hash: string;
  text: string;
}

export interface EventLogHeader {
  schema_version: 1;
  session_id: string;
  machine: string;
  created_at: string;
}

export interface HistoryDocument {
  header: EventLogHeader;
  extraFields: FrontmatterData;
  events: HistoryEvent[];
}

export interface ClipboardDocument {
  header: EventLogHeader;
  extraFields: FrontmatterData;
  events: ClipboardEvent[];
}

export interface SessionDocuments {
  session: string;
  history: string;
  clipboard: string;
}

const SESSION_KEYS = ['schema_version', 'session_id', 'machine', 'created_at', 'window_id', 'kind', 'ssh_alias', 'cwd_initial', 'started_at', 'ended_at', 'os', 'shell', 'env_source', 'env_detected_at'];
const LOG_KEYS = ['schema_version', 'session_id', 'machine', 'created_at'];
const EVENT_ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const SINGLE_LINE_MAX = 4096;

function parseFrontmatterDocument(content: string): { data: FrontmatterData; body: string } {
  let parsed;
  try {
    parsed = parseFrontmatter(content);
  } catch (error) {
    if (error instanceof FrontmatterError) {
      throw new SchemaError('SCHEMA_INVALID_DOCUMENT', error.code);
    }
    throw error;
  }
  if (!parsed.hasFrontmatter) {
    throw new SchemaError('SCHEMA_MISSING_FRONTMATTER');
  }
  if (parsed.data['schema_version'] !== SCHEMA_VERSION) {
    throw new SchemaError('SCHEMA_INVALID_VERSION');
  }
  return { data: parsed.data, body: parsed.body };
}

function splitFields(data: FrontmatterData, keys: string[], policy: UnknownFieldPolicy): { known: FrontmatterData; extra: FrontmatterData } {
  try {
    return splitKnownFields(data, keys, policy);
  } catch (error) {
    if (error instanceof FrontmatterError) {
      throw new SchemaError('SCHEMA_INVALID_FIELD', error.message);
    }
    throw error;
  }
}

function requireString(data: FrontmatterData, key: string): string {
  const value = data[key];
  if (value === undefined) {
    throw new SchemaError('SCHEMA_MISSING_FIELD', key);
  }
  if (typeof value !== 'string' || value.length === 0) {
    throw new SchemaError('SCHEMA_INVALID_FIELD', key);
  }
  return value;
}

function optionalString(data: FrontmatterData, key: string): string | undefined {
  return data[key] === undefined || data[key] === null ? undefined : requireString(data, key);
}

function requireTimestamp(data: FrontmatterData, key: string): string {
  const value = requireString(data, key);
  if (!isIsoTimestamp(value)) {
    throw new SchemaError('SCHEMA_INVALID_FIELD', key);
  }
  return value;
}

function validateSessionMeta(meta: SessionMeta): void {
  if (meta.schema_version !== SCHEMA_VERSION) {
    throw new SchemaError('SCHEMA_INVALID_VERSION');
  }
  if (parseSessionLabel(meta.session_id) === null) {
    throw new SchemaError('SCHEMA_INVALID_FIELD', 'session_id');
  }
  if (!isValidMachine(meta.machine)) {
    throw new SchemaError('SCHEMA_INVALID_FIELD', 'machine');
  }
  if (meta.window_id.length === 0 || meta.cwd_initial.length === 0) {
    throw new SchemaError('SCHEMA_INVALID_FIELD', 'window_id/cwd_initial');
  }
  if (meta.kind !== 'local' && meta.kind !== 'ssh') {
    throw new SchemaError('SCHEMA_INVALID_FIELD', 'kind');
  }
  if ((meta.kind === 'ssh') !== (meta.ssh_alias !== undefined)) {
    throw new SchemaError('SCHEMA_INVALID_FIELD', 'ssh_alias');
  }
  if (!isIsoTimestamp(meta.created_at) || !isIsoTimestamp(meta.started_at) || (meta.ended_at !== undefined && !isIsoTimestamp(meta.ended_at)) || (meta.env_detected_at !== undefined && !isIsoTimestamp(meta.env_detected_at))) {
    throw new SchemaError('SCHEMA_INVALID_FIELD', 'timestamp');
  }
}

export function serializeSessionDocument(meta: SessionMeta, extraFields: FrontmatterData = {}, body?: string): string {
  validateSessionMeta(meta);
  const data: FrontmatterData = {
    schema_version: meta.schema_version,
    session_id: meta.session_id,
    machine: meta.machine,
    created_at: meta.created_at,
    window_id: meta.window_id,
    kind: meta.kind,
  };
  if (meta.ssh_alias !== undefined) {
    data['ssh_alias'] = meta.ssh_alias;
  }
  data['cwd_initial'] = meta.cwd_initial;
  data['started_at'] = meta.started_at;
  if (meta.ended_at !== undefined) data['ended_at'] = meta.ended_at;
  if (meta.os !== undefined) data['os'] = meta.os;
  if (meta.shell !== undefined) data['shell'] = meta.shell;
  if (meta.env_source !== undefined) data['env_source'] = meta.env_source;
  if (meta.env_detected_at !== undefined) data['env_detected_at'] = meta.env_detected_at;
  for (const [key, value] of Object.entries(extraFields)) {
    if (SESSION_KEYS.includes(key)) {
      throw new SchemaError('SCHEMA_INVALID_FIELD', key);
    }
    data[key] = value;
  }
  return serializeFrontmatter(data, body ?? `\n# Sessione ${meta.session_id}\n`);
}

export function parseSessionDocument(content: string, options: ParseOptions = {}): SessionDocument {
  const { data, body } = parseFrontmatterDocument(content);
  const { known, extra } = splitFields(data, SESSION_KEYS, options.unknownFields ?? 'preserve');
  const kind = requireString(known, 'kind');
  if (kind !== 'local' && kind !== 'ssh') {
    throw new SchemaError('SCHEMA_INVALID_FIELD', 'kind');
  }
  const sshAlias = optionalString(known, 'ssh_alias');
  const endedAt = known['ended_at'] === undefined ? undefined : requireTimestamp(known, 'ended_at');
  const osValue = known['os'];
  const shellValue = known['shell'];
  const sourceValue = known['env_source'];
  const enumValue = <T extends string>(value: FrontmatterScalar | undefined, values: readonly T[], key: string): T | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !values.includes(value as T)) throw new SchemaError('SCHEMA_INVALID_FIELD', key);
    return value as T;
  };
  const envOs = enumValue(osValue, ['linux', 'macos', 'windows', 'unknown'], 'os');
  const envShell = enumValue(shellValue, ['bash', 'zsh', 'fish', 'sh', 'pwsh', 'powershell', 'cmd', 'unknown'], 'shell');
  const envSource = enumValue(sourceValue, ['local', 'ssh-probe', 'unknown'], 'env_source');
  const envDetectedAt = known['env_detected_at'] === undefined ? undefined : requireTimestamp(known, 'env_detected_at');
  const meta: SessionMeta = {
    schema_version: SCHEMA_VERSION,
    session_id: requireString(known, 'session_id'),
    machine: requireString(known, 'machine'),
    created_at: requireTimestamp(known, 'created_at'),
    window_id: requireString(known, 'window_id'),
    kind,
    ...(sshAlias !== undefined ? { ssh_alias: sshAlias } : {}),
    cwd_initial: requireString(known, 'cwd_initial'),
    started_at: requireTimestamp(known, 'started_at'),
    ...(endedAt !== undefined ? { ended_at: endedAt } : {}),
    ...(envOs !== undefined ? { os: envOs } : {}),
    ...(envShell !== undefined ? { shell: envShell } : {}),
    ...(envSource !== undefined ? { env_source: envSource } : {}),
    ...(envDetectedAt !== undefined ? { env_detected_at: envDetectedAt } : {}),
  };
  validateSessionMeta(meta);
  return { meta, extraFields: extra, body };
}

function serializeLogHeader(header: EventLogHeader, extraFields: FrontmatterData, body: string): string {
  const data: FrontmatterData = {
    schema_version: header.schema_version,
    session_id: header.session_id,
    machine: header.machine,
    created_at: header.created_at,
  };
  for (const [key, value] of Object.entries(extraFields)) {
    if (LOG_KEYS.includes(key)) {
      throw new SchemaError('SCHEMA_INVALID_FIELD', key);
    }
    data[key] = value;
  }
  return serializeFrontmatter(data, body);
}

function parseLogHeader(content: string, options: ParseOptions): { header: EventLogHeader; extra: FrontmatterData; body: string } {
  const { data, body } = parseFrontmatterDocument(content);
  const { known, extra } = splitFields(data, LOG_KEYS, options.unknownFields ?? 'preserve');
  const header: EventLogHeader = {
    schema_version: SCHEMA_VERSION,
    session_id: requireString(known, 'session_id'),
    machine: requireString(known, 'machine'),
    created_at: requireTimestamp(known, 'created_at'),
  };
  if (parseSessionLabel(header.session_id) === null) {
    throw new SchemaError('SCHEMA_INVALID_FIELD', 'session_id');
  }
  if (!isValidMachine(header.machine)) {
    throw new SchemaError('SCHEMA_INVALID_FIELD', 'machine');
  }
  return { header, extra, body };
}

/** Creates the three initial session documents (history and clipboard without events). */
export function createSessionDocuments(meta: SessionMeta): SessionDocuments {
  const header: EventLogHeader = {
    schema_version: SCHEMA_VERSION,
    session_id: meta.session_id,
    machine: meta.machine,
    created_at: meta.started_at,
  };
  return {
    session: serializeSessionDocument(meta),
    history: serializeLogHeader(header, {}, `\n# History ${meta.session_id}\n`),
    clipboard: serializeLogHeader(header, {}, `\n# Clipboard ${meta.session_id}\n`),
  };
}

// ---------------------------------------------------------------------------
// Events (sections `## <ISO8601> · <event-id>` with `key: value` metadata and a fenced `text` block)

const EVENT_SEPARATOR = ' · ';

function fenceFor(text: string): string {
  let longest = 0;
  for (const match of text.matchAll(/`+/g)) {
    longest = Math.max(longest, match[0].length);
  }
  return '`'.repeat(Math.max(3, longest + 1));
}

function assertSingleLine(value: string, field: string): void {
  if (/[\r\n]/.test(value) || value.length === 0 || value.length > SINGLE_LINE_MAX) {
    throw new SchemaError('SCHEMA_INVALID_EVENT', field);
  }
}

function renderEvent(id: string, timestamp: string, fields: Array<[string, string | undefined]>, text: string): string {
  if (!EVENT_ID_PATTERN.test(id)) {
    throw new SchemaError('SCHEMA_INVALID_EVENT', 'id');
  }
  if (!isIsoTimestamp(timestamp)) {
    throw new SchemaError('SCHEMA_INVALID_EVENT', 'timestamp');
  }
  const lines = [`## ${timestamp}${EVENT_SEPARATOR}${id}`, ''];
  for (const [key, value] of fields) {
    if (value !== undefined) {
      assertSingleLine(value, key);
      lines.push(`- ${key}: ${value}`);
    }
  }
  const fence = fenceFor(text);
  lines.push('', `${fence}text`, text, fence, '');
  return lines.join('\n');
}

interface RawEvent {
  id: string;
  timestamp: string;
  fields: Map<string, string>;
  text: string;
}

function parseEvents(body: string): RawEvent[] {
  const lines = body.split('\n');
  const stripCr = (line: string | undefined): string => (line ?? '').replace(/\r$/, '');
  const events: RawEvent[] = [];
  let index = 0;
  while (index < lines.length) {
    const heading = /^## (\S+) · (\S+)$/.exec(stripCr(lines[index]));
    if (heading === null) {
      index += 1;
      continue;
    }
    const timestamp = heading[1] ?? '';
    const id = heading[2] ?? '';
    if (!isIsoTimestamp(timestamp) || !EVENT_ID_PATTERN.test(id)) {
      throw new SchemaError('SCHEMA_INVALID_EVENT', 'heading');
    }
    index += 1;
    const fields = new Map<string, string>();
    let text: string | undefined;
    while (index < lines.length && text === undefined) {
      const line = stripCr(lines[index]);
      const field = /^- ([a-z_]+): (.*)$/.exec(line);
      const open = /^(`{3,})text$/.exec(line);
      if (field !== null) {
        fields.set(field[1] ?? '', field[2] ?? '');
      } else if (open !== null) {
        const fence = open[1] ?? '';
        const start = index + 1;
        let end = start;
        while (end < lines.length && stripCr(lines[end]) !== fence) {
          end += 1;
        }
        if (end >= lines.length) {
          throw new SchemaError('SCHEMA_INVALID_EVENT', 'unterminated fence');
        }
        text = lines.slice(start, end).join('\n');
        index = end;
      } else if (line.trim() !== '') {
        throw new SchemaError('SCHEMA_INVALID_EVENT', 'unexpected line');
      }
      index += 1;
    }
    if (text === undefined) {
      throw new SchemaError('SCHEMA_INVALID_EVENT', 'missing text block');
    }
    events.push({ id, timestamp, fields, text });
  }
  return events;
}

function eventSectionStart(body: string): number {
  const match = /^## /m.exec(body);
  return match === null ? body.length : match.index;
}

function appendSection(content: string, section: string): string {
  const base = content.endsWith('\n') ? content : `${content}\n`;
  return `${base}${base.endsWith('\n\n') ? '' : '\n'}${section}`;
}

export function parseHistoryDocument(content: string, options: ParseOptions = {}): HistoryDocument {
  const { header, extra, body } = parseLogHeader(content, options);
  const events = parseEvents(body.slice(eventSectionStart(body))).map((raw): HistoryEvent => {
    const source = raw.fields.get('source');
    if (source !== 'shell' && source !== 'assisted') {
      throw new SchemaError('SCHEMA_INVALID_EVENT', 'source');
    }
    const agent = raw.fields.get('agent');
    const cwd = raw.fields.get('cwd');
    return {
      id: raw.id,
      timestamp: raw.timestamp,
      source,
      ...(agent !== undefined ? { agent } : {}),
      ...(cwd !== undefined ? { cwd } : {}),
      text: raw.text,
    };
  });
  return { header, extraFields: extra, events };
}

/** Idempotent by ID: returns unchanged content when the event is already present. */
export function appendHistoryEvent(content: string, event: HistoryEvent): string {
  const existing = parseHistoryDocument(content);
  const section = renderEvent(
    event.id,
    event.timestamp,
    [
      ['source', event.source],
      ['agent', event.agent],
      ['cwd', event.cwd],
    ],
    event.text,
  );
  if (event.source !== 'shell' && event.source !== 'assisted') {
    throw new SchemaError('SCHEMA_INVALID_EVENT', 'source');
  }
  if (existing.events.some((candidate) => candidate.id === event.id)) {
    return content;
  }
  return appendSection(content, section);
}

/**
 * Removes one event section by id, preserving the frontmatter, title and every other
 * event verbatim. Returns `null` when the id is not present (callers must not rewrite
 * the file in that case).
 */
export function removeHistoryEvent(content: string, id: string): string | null {
  const document = parseHistoryDocument(content);
  if (!document.events.some((event) => event.id === id)) {
    return null;
  }
  const remaining = document.events.filter((event) => event.id !== id);
  const sections = remaining.map((event) =>
    renderEvent(event.id, event.timestamp, [['source', event.source], ['agent', event.agent], ['cwd', event.cwd]], event.text),
  );
  return rebuildEventLog(content, document.header, document.extraFields, sections);
}

/** Clipboard counterpart of `removeHistoryEvent`; same preservation rules. */
export function removeClipboardEvent(content: string, id: string): string | null {
  const document = parseClipboardDocument(content);
  if (!document.events.some((event) => event.id === id)) {
    return null;
  }
  const remaining = document.events.filter((event) => event.id !== id);
  const sections = remaining.map((event) =>
    renderEvent(event.id, event.timestamp, [['type', event.type], ['source', event.source], ['hash', event.hash]], event.text),
  );
  return rebuildEventLog(content, document.header, document.extraFields, sections);
}

function rebuildEventLog(content: string, header: EventLogHeader, extraFields: FrontmatterData, sections: string[]): string {
  const { body } = parseFrontmatterDocument(content);
  const preamble = body.slice(0, eventSectionStart(body));
  const nextBody = sections.length === 0 ? `${preamble.trimEnd()}\n` : `${preamble}${sections.join('\n')}`;
  return serializeLogHeader(header, extraFields, nextBody);
}

export function hashClipboardText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function parseClipboardDocument(content: string, options: ParseOptions = {}): ClipboardDocument {
  const { header, extra, body } = parseLogHeader(content, options);
  const events = parseEvents(body.slice(eventSectionStart(body))).map((raw): ClipboardEvent => {
    const hash = raw.fields.get('hash');
    if (raw.fields.get('type') !== 'text' || hash === undefined || !/^[0-9a-f]{64}$/.test(hash)) {
      throw new SchemaError('SCHEMA_INVALID_EVENT', 'type/hash');
    }
    const source = raw.fields.get('source');
    return { id: raw.id, timestamp: raw.timestamp, type: 'text', ...(source !== undefined ? { source } : {}), hash, text: raw.text };
  });
  return { header, extraFields: extra, events };
}

/** Idempotent by ID and hash: a duplicate returns unchanged content. */
export function appendClipboardEvent(content: string, event: ClipboardEvent): string {
  const existing = parseClipboardDocument(content);
  if (event.type !== 'text' || !/^[0-9a-f]{64}$/.test(event.hash)) {
    throw new SchemaError('SCHEMA_INVALID_EVENT', 'type/hash');
  }
  const section = renderEvent(
    event.id,
    event.timestamp,
    [
      ['type', event.type],
      ['source', event.source],
      ['hash', event.hash],
    ],
    event.text,
  );
  if (existing.events.some((candidate) => candidate.id === event.id || candidate.hash === event.hash)) {
    return content;
  }
  return appendSection(content, section);
}

// ---------------------------------------------------------------------------

let temporaryCounter = 0;

/** Writes a file atomically: temporary file in the same directory, then fsync and rename. */
export function writeFileAtomic(filePath: string, content: string): void {
  const directory = path.dirname(filePath);
  temporaryCounter += 1;
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${temporaryCounter}.${Date.now().toString(36)}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o644);
    fs.writeFileSync(descriptor, content, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, filePath);
  } catch (error) {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

export type { FrontmatterScalar };
