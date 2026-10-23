import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendClipboardEvent,
  appendHistoryEvent,
  createSessionDocuments,
  hashClipboardText,
  parseClipboardDocument,
  parseHistoryDocument,
  parseSessionDocument,
  serializeSessionDocument,
  writeFileAtomic,
  type ClipboardEvent,
  type HistoryEvent,
  type SessionMeta,
} from './schema';

const meta: SessionMeta = {
  schema_version: 1,
  session_id: 'S3',
  machine: 'host-1',
  created_at: '2026-10-22T10:05:03+02:00',
  window_id: 'win-uuid',
  kind: 'local',
  cwd_initial: '/home/user/my dir: #1',
  started_at: '2026-10-22T10:05:03+02:00',
};

const T = '2026-10-22T10:06:00+02:00';

describe('session.md', () => {
  it('roundtrips meta with and without optional fields', () => {
    const { session } = createSessionDocuments(meta);
    expect(parseSessionDocument(session).meta).toEqual(meta);
    const ssh: SessionMeta = { ...meta, kind: 'ssh', ssh_alias: 'prod', ended_at: '2026-10-22T11:00:00+02:00' };
    expect(parseSessionDocument(serializeSessionDocument(ssh)).meta).toEqual(ssh);
  });

  it('is human readable', () => {
    expect(createSessionDocuments(meta).session).toBe(
      [
        '---',
        'schema_version: 1',
        'session_id: S3',
        'machine: host-1',
        'created_at: "2026-10-22T10:05:03+02:00"',
        'window_id: win-uuid',
        'kind: local',
        'cwd_initial: "/home/user/my dir: #1"',
        'started_at: "2026-10-22T10:05:03+02:00"',
        '---',
        '',
        '# Sessione S3',
        '',
      ].join('\n'),
    );
  });

  it('preserves unknown fields and body, or rejects on request', () => {
    const text = serializeSessionDocument(meta, { future_flag: true }, '\nnote\n');
    const parsed = parseSessionDocument(text);
    expect(parsed.extraFields).toEqual({ future_flag: true });
    expect(parsed.body).toBe('\nnote\n');
    expect(serializeSessionDocument({ ...parsed.meta, ended_at: T }, parsed.extraFields, parsed.body)).toContain('future_flag: true');
    expect(() => parseSessionDocument(text, { unknownFields: 'reject' })).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID_FIELD' }));
  });

  it('rejects invalid schema_version, missing frontmatter and bad fields', () => {
    const { session } = createSessionDocuments(meta);
    expect(() => parseSessionDocument(session.replace('schema_version: 1', 'schema_version: 2'))).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID_VERSION' }));
    expect(() => parseSessionDocument(session.replace('schema_version: 1', 'schema_version: "1"'))).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID_VERSION' }));
    expect(() => parseSessionDocument(session.replace('schema_version: 1\n', ''))).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID_VERSION' }));
    expect(() => parseSessionDocument('# nope')).toThrow(expect.objectContaining({ code: 'SCHEMA_MISSING_FRONTMATTER' }));
    expect(() => parseSessionDocument(session.replace('session_id: S3\n', ''))).toThrow(expect.objectContaining({ code: 'SCHEMA_MISSING_FIELD' }));
    expect(() => parseSessionDocument(session.replace('session_id: S3', 'session_id: X3'))).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID_FIELD' }));
    expect(() => parseSessionDocument(session.replace('kind: local', 'kind: ssh'))).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID_FIELD' }));
    expect(() => serializeSessionDocument({ ...meta, started_at: 'ieri' })).toThrow();
    expect(() => parseSessionDocument(session.replace('created_at: "2026-10-22T10:05:03+02:00"\n', ''))).toThrow(
      expect.objectContaining({ code: 'SCHEMA_MISSING_FIELD' }),
    );
  });

  it('creates history and clipboard with common frontmatter and no events', () => {
    const docs = createSessionDocuments(meta);
    for (const text of [docs.history, docs.clipboard]) {
      expect(text.startsWith('---\nschema_version: 1\nsession_id: S3\nmachine: host-1\ncreated_at: "2026-10-22T10:05:03+02:00"\n---\n')).toBe(true);
    }
    expect(parseHistoryDocument(docs.history).events).toEqual([]);
    expect(parseClipboardDocument(docs.clipboard).header.created_at).toBe(meta.started_at);
  });
});

describe('history.md', () => {
  const initial = createSessionDocuments(meta).history;

  it('appends events and roundtrips multiline/unicode/backtick text', () => {
    const events: HistoryEvent[] = [
      { id: 'e1', timestamp: T, source: 'assisted', agent: 'claude', cwd: '/tmp/x', text: 'ls -la\necho "city 🚀"' },
      { id: 'e2', timestamp: T, source: 'shell', text: 'echo ```nested``` and ````four````\n## not a heading\n' },
      { id: 'e3', timestamp: T, source: 'assisted', text: '' },
      { id: 'e4', timestamp: T, source: 'assisted', text: '\r\nwin\r\n' },
    ];
    let content = initial;
    for (const event of events) {
      content = appendHistoryEvent(content, event);
    }
    expect(parseHistoryDocument(content).events).toEqual(events);
    expect(content).toContain('## 2026-10-22T10:06:00+02:00 · e1\n\n- source: assisted\n- agent: claude\n- cwd: /tmp/x\n\n```text\nls -la');
    expect(content).toContain('`````text\necho ```nested``` and ````four````');
  });

  it('is idempotent by id', () => {
    const event: HistoryEvent = { id: 'e1', timestamp: T, source: 'assisted', text: 'a' };
    const once = appendHistoryEvent(initial, event);
    expect(appendHistoryEvent(once, event)).toBe(once);
    expect(appendHistoryEvent(once, { ...event, text: 'different' })).toBe(once);
  });

  it('rejects invalid events', () => {
    const base: HistoryEvent = { id: 'e1', timestamp: T, source: 'assisted', text: 'a' };
    expect(() => appendHistoryEvent(initial, { ...base, id: 'bad id' })).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID_EVENT' }));
    expect(() => appendHistoryEvent(initial, { ...base, timestamp: 'x' })).toThrow();
    expect(() => appendHistoryEvent(initial, { ...base, cwd: 'a\nb' })).toThrow();
    expect(() => appendHistoryEvent(initial, { ...base, source: 'other' as 'shell' })).toThrow();
    expect(() => parseHistoryDocument(initial + '\n## 2026-10-22T10:06:00+02:00 · e1\n\n- source: shell\n')).toThrow();
  });

  it('preserves unknown frontmatter fields', () => {
    const withExtra = initial.replace('created_at', 'future: 1\ncreated_at');
    expect(parseHistoryDocument(withExtra).extraFields).toEqual({ future: 1 });
    expect(() => parseHistoryDocument(withExtra, { unknownFields: 'reject' })).toThrow();
  });
});

describe('clipboard.md', () => {
  const initial = createSessionDocuments(meta).clipboard;
  const make = (id: string, text: string, source?: string): ClipboardEvent => ({
    id,
    timestamp: T,
    type: 'text',
    ...(source !== undefined ? { source } : {}),
    hash: hashClipboardText(text),
    text,
  });

  it('roundtrips and dedupes by id and hash', () => {
    const a = make('c1', 'hello\n```code```\nciao 日本', 'terminal');
    const b = make('c2', 'other');
    let content = appendClipboardEvent(initial, a);
    content = appendClipboardEvent(content, b);
    expect(parseClipboardDocument(content).events).toEqual([a, b]);
    expect(appendClipboardEvent(content, make('c3', 'other'))).toBe(content);
    expect(appendClipboardEvent(content, { ...make('c1', 'new text') })).toBe(content);
    expect(content).toContain('- type: text\n- source: terminal\n- hash: ' + a.hash);
  });

  it('rejects invalid hash', () => {
    expect(() => appendClipboardEvent(initial, { ...make('c1', 'x'), hash: 'abc' })).toThrow(expect.objectContaining({ code: 'SCHEMA_INVALID_EVENT' }));
  });
});

describe('writeFileAtomic', () => {
  it('writes, overwrites and leaves no temporary files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-atomic-'));
    try {
      const file = path.join(dir, 'a.md');
      writeFileAtomic(file, 'one');
      writeFileAtomic(file, 'two');
      expect(fs.readFileSync(file, 'utf8')).toBe('two');
      expect(fs.readdirSync(dir)).toEqual(['a.md']);
      expect(() => writeFileAtomic(path.join(dir, 'missing', 'a.md'), 'x')).toThrow();
      expect(fs.readdirSync(dir)).toEqual(['a.md']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
