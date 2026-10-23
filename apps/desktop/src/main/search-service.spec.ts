import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataRuntime } from './data-runtime';
import { HistoryService } from './history-service';
import { SearchService } from './search-service';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-searchsvc-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('SearchService', () => {
  it('indexes history writes and session end, and rebuilds on a new instance', async () => {
    const runtime = new DataRuntime({ userDataPath: path.join(root, 'ud'), env: { SMART_TERMINAL_DATA_REPO: path.join(root, 'repo'), SMART_TERMINAL_MACHINE: 'host' } });
    const search = new SearchService(runtime.dataRepoPath);
    const upsert = vi.spyOn(search, 'upsertSession');
    runtime.onSessionEnded((dir) => search.upsertSession(dir));
    const { allocation } = await runtime.createSession('w', { kind: 'local', cwd: '/tmp' });
    const history = new HistoryService({
      dataRepoPath: runtime.dataRepoPath,
      resolveSession: () => ({ sessionDirectory: allocation.relativeDir }),
      onRecorded: (dir) => search.upsertSession(dir),
    });
    expect(search.query({ query: 'needle' }).entries).toEqual([]);
    history.record(1, { sessionId: 'S1', text: 'echo Needle' });
    expect(search.query({ query: 'needle' }).entries).toMatchObject([{ machine: 'host', sessionId: 'S1', kind: 'history', source: 'assisted' }]);
    runtime.endSession('S1');
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(new SearchService(runtime.dataRepoPath).query({ query: 'NEEDLE' }).entries).toHaveLength(1);
  });

  it('does not throw on invalid upsert and exposes refresh', () => {
    fs.mkdirSync(path.join(root, 'repo', 'sessions'), { recursive: true });
    const search = new SearchService(path.join(root, 'repo'));
    expect(() => search.upsertSession('../x')).not.toThrow();
    expect(() => search.refresh()).not.toThrow();
  });
});
