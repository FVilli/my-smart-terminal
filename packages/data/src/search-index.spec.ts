import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarkdownSearchIndex, SEARCH_MAX_RESULTS } from './search-index';
import { appendClipboardEvent, appendHistoryEvent, createSessionDocuments, hashClipboardText, type SessionMeta } from './schema';

let repo: string;

interface Fixture {
  machine: string;
  dir: string;
  label: string;
  history?: Array<{ ts: string; text: string; cwd?: string }>;
  clipboard?: Array<{ ts: string; text: string }>;
}

function createSession(fixture: Fixture): string {
  const meta: SessionMeta = {
    schema_version: 1,
    session_id: fixture.label,
    machine: fixture.machine,
    created_at: '2026-03-01T10:00:00+00:00',
    window_id: 'w',
    kind: 'local',
    cwd_initial: '/work',
    started_at: '2026-03-01T10:00:00+00:00',
  };
  const docs = createSessionDocuments(meta);
  let history = docs.history;
  let clipboard = docs.clipboard;
  fixture.history?.forEach((event, i) => {
    history = appendHistoryEvent(history, { id: `h${i}`, timestamp: event.ts, source: 'assisted', ...(event.cwd ? { cwd: event.cwd } : {}), text: event.text });
  });
  fixture.clipboard?.forEach((event, i) => {
    clipboard = appendClipboardEvent(clipboard, { id: `c${i}`, timestamp: event.ts, type: 'text', hash: hashClipboardText(event.text), text: event.text });
  });
  const relative = `sessions/${fixture.machine}/${fixture.dir}`;
  const absolute = path.join(repo, relative);
  fs.mkdirSync(absolute, { recursive: true });
  fs.writeFileSync(path.join(absolute, 'session.md'), docs.session);
  fs.writeFileSync(path.join(absolute, 'history.md'), history);
  fs.writeFileSync(path.join(absolute, 'clipboard.md'), clipboard);
  return relative;
}

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'st-search-'));
  createSession({
    machine: 'alpha',
    dir: '2026-03-01_10.00_S1_local',
    label: 'S1',
    history: [
      { ts: '2026-03-01T10:01:00+00:00', text: 'git status', cwd: '/work' },
      { ts: '2026-03-01T10:03:00+00:00', text: 'Echo Hello' },
    ],
    clipboard: [{ ts: '2026-03-01T10:02:00+00:00', text: 'hello from clipboard' }],
  });
  createSession({
    machine: 'beta',
    dir: '2026-03-02_09.00_S1_local',
    label: 'S1',
    history: [{ ts: '2026-03-02T09:01:00+00:00', text: 'echo HELLO beta' }],
  });
  createSession({ machine: 'alpha', dir: '2026-03-03_09.00_S2_local', label: 'S2', history: [{ ts: '2026-03-03T09:01:00+00:00', text: 'ls hello' }] });
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

function built(options: { maxFileBytes?: number } = {}): MarkdownSearchIndex {
  const index = new MarkdownSearchIndex({ dataRepoPath: repo, ...options });
  index.rebuild();
  return index;
}

describe('MarkdownSearchIndex', () => {
  it('searches case-insensitively across machines and sessions, newest first', () => {
    const results = built().query({ query: 'HeLLo' });
    expect(results.map((r) => `${r.machine}/${r.sessionId}/${r.kind}`)).toEqual([
      'alpha/S2/history',
      'beta/S1/history',
      'alpha/S1/history',
      'alpha/S1/clipboard',
    ]);
    expect(results[0]).toMatchObject({ sessionDirectory: 'sessions/alpha/2026-03-03_09.00_S2_local', source: 'assisted', text: 'ls hello' });
    expect(built().query({ query: 'git' })[0]).toMatchObject({ cwd: '/work' });
  });

  it('filters by machine, session, kind and date range', () => {
    const index = built();
    expect(index.query({ query: 'hello', machine: 'beta' })).toHaveLength(1);
    expect(index.query({ query: 'hello', machine: 'alpha', sessionId: 'S1' })).toHaveLength(2);
    expect(index.query({ query: 'hello', kind: 'clipboard' }).map((r) => r.text)).toEqual(['hello from clipboard']);
    expect(index.query({ query: 'hello', from: '2026-03-02T00:00:00+00:00' })).toHaveLength(2);
    expect(index.query({ query: 'hello', to: '2026-03-01T10:02:00+00:00' }).map((r) => r.kind)).toEqual(['clipboard']);
    expect(index.query({ query: 'hello', from: '2026-03-01T10:03:00+00:00', to: '2026-03-01T10:03:00+00:00' })).toHaveLength(1);
    expect(index.query({ query: '' , machine: 'beta' })).toHaveLength(1);
    expect(index.query({ query: 'nothing-here' })).toEqual([]);
  });

  it('caps results at 100, newest first', () => {
    const history = Array.from({ length: 130 }, (_, i) => ({
      ts: `2026-04-01T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00+00:00`,
      text: `bulk ${i}`,
    }));
    createSession({ machine: 'gamma', dir: '2026-04-01_00.00_S1_local', label: 'S1', history });
    const results = built().query({ query: 'bulk' });
    expect(results).toHaveLength(SEARCH_MAX_RESULTS);
    expect(results[0]?.text).toBe('bulk 129');
  });

  it('rebuilds from disk in a new instance (restart) and refreshes/upserts changes', () => {
    const first = built();
    const second = built();
    expect(second.query({ query: 'hello' })).toEqual(first.query({ query: 'hello' }));

    const relative = 'sessions/alpha/2026-03-01_10.00_S1_local';
    const historyPath = path.join(repo, relative, 'history.md');
    fs.writeFileSync(
      historyPath,
      appendHistoryEvent(fs.readFileSync(historyPath, 'utf8'), { id: 'late', timestamp: '2026-03-05T00:00:00+00:00', source: 'assisted', text: 'late hello' }),
    );
    expect(first.query({ query: 'late' })).toEqual([]);
    first.upsertSession(relative);
    expect(first.query({ query: 'late' })).toHaveLength(1);

    createSession({ machine: 'delta', dir: '2026-05-01_00.00_S1_local', label: 'S1', history: [{ ts: '2026-05-01T00:00:00+00:00', text: 'delta cmd' }] });
    expect(second.query({ query: 'delta' })).toEqual([]);
    second.refresh();
    expect(second.query({ query: 'delta' })).toHaveLength(1);
    expect(second.query({ query: 'late' })).toHaveLength(1);

    fs.rmSync(path.join(repo, 'sessions', 'delta'), { recursive: true });
    second.refresh();
    expect(second.query({ query: 'delta' })).toEqual([]);
  });

  it('ignores invalid upsert paths without throwing', () => {
    const index = built();
    const before = index.entryCount;
    index.upsertSession('../outside');
    index.upsertSession('sessions/alpha/not-a-session');
    expect(index.entryCount).toBe(before);
  });

  it('does not follow symlinked sessions, machines or files', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'st-search-outside-'));
    try {
      const relative = createSession({ machine: 'evil', dir: '2026-06-01_00.00_S1_local', label: 'S1', history: [{ ts: '2026-06-01T00:00:00+00:00', text: 'symlinked secret' }] });
      fs.renameSync(path.join(repo, relative), path.join(outside, 'session'));
      fs.symlinkSync(path.join(outside, 'session'), path.join(repo, relative), 'dir');
      fs.symlinkSync(path.join(outside, 'session'), path.join(repo, 'sessions', 'alpha', '2026-07-01_00.00_S9_local'), 'dir');
      const linkedFileRel = 'sessions/alpha/2026-03-03_09.00_S2_local/history.md';
      const real = path.join(repo, linkedFileRel);
      fs.copyFileSync(real, path.join(outside, 'history.md'));
      fs.writeFileSync(real + '.keep', '');
      fs.rmSync(real);
      fs.symlinkSync(path.join(outside, 'history.md'), real);
      const index = built();
      expect(index.query({ query: 'symlinked secret' })).toEqual([]);
      expect(index.query({ query: 'ls hello' })).toEqual([]);
      index.upsertSession(relative);
      expect(index.query({ query: 'symlinked secret' })).toEqual([]);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('skips files over the size limit and unparsable sessions', () => {
    const relative = createSession({ machine: 'big', dir: '2026-08-01_00.00_S1_local', label: 'S1', history: [{ ts: '2026-08-01T00:00:00+00:00', text: 'huge marker' }] });
    expect(built().query({ query: 'huge marker' })).toHaveLength(1);
    const historyPath = path.join(repo, relative, 'history.md');
    const original = fs.readFileSync(historyPath, 'utf8');
    fs.writeFileSync(historyPath, appendHistoryEvent(original, { id: 'pad', timestamp: '2026-08-01T00:01:00+00:00', source: 'assisted', text: 'x'.repeat(2.1 * 1024 * 1024) }));
    expect(built().query({ query: 'huge marker' })).toEqual([]);
    expect(built({ maxFileBytes: 4 * 1024 * 1024 }).query({ query: 'huge marker' })).toHaveLength(1);
    fs.writeFileSync(historyPath, original);
    fs.writeFileSync(historyPath, 'garbage');
    expect(built().query({ query: 'huge marker' })).toEqual([]);
    expect(built().query({ query: 'git status' })).toHaveLength(1);
  });

  it('keeps only Markdown in memory and writes no database or extra files', () => {
    const before = listAll(repo);
    built().query({ query: 'hello' });
    expect(listAll(repo)).toEqual(before);
    expect(before.every((file) => file.endsWith('.md'))).toBe(true);
  });
});

function listAll(root: string): string[] {
  return fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => path.join(dirent.parentPath, dirent.name))
    .sort();
}
