import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchQueryRequest, SearchQueryResult, SearchResultEntry, SyncStatusEvent } from '@smart-terminal/contracts';
import { syncBadge } from '../apps/renderer/src/app/session.model';
import { SEARCH_DEBOUNCE_MS, SEARCH_REFRESH_INTERVAL_MS, SearchStore } from '../apps/renderer/src/app/search/search-store';
import { SYNC_STATUS_POLL_MS, SyncStatusStore } from '../apps/renderer/src/app/sync-status/sync-status-store';
import { previewText, shortTimestamp } from '../apps/renderer/src/app/sidebar-panel/sidebar-panel';

const entry = (text: string, machine = 'alpha'): SearchResultEntry => ({
  id: `e-${text}`,
  machine,
  sessionId: 'S1',
  sessionDirectory: `sessions/${machine}/2026-01-01_00.00_S1_local`,
  kind: 'history',
  timestamp: '2026-01-01T10:00:00+00:00',
  text,
  source: 'assisted',
});

describe('SearchStore', () => {
  const search = vi.fn<(request: SearchQueryRequest) => Promise<SearchQueryResult>>();
  const searchFacets = vi.fn();
  const clipboardWrite = vi.fn();
  const searchRemove = vi.fn();
  let refreshed: () => void = () => undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    search.mockReset().mockResolvedValue({ entries: [] });
    searchFacets.mockReset().mockResolvedValue({ machines: ['alpha', 'beta'] });
    clipboardWrite.mockReset().mockResolvedValue(undefined);
    searchRemove.mockReset().mockResolvedValue({ removed: true });
    vi.stubGlobal('smartTerminal', {
      search,
      searchFacets,
      clipboardWrite,
      searchRemove,
      onSearchRefreshed: (listener: () => void) => {
        refreshed = listener;
        return () => undefined;
      },
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('debounces the query by 200ms and trims it', async () => {
    const store = new SearchStore();
    store.setQuery('e');
    store.setQuery('ec');
    store.setQuery(' echo ');
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith({ query: 'echo', kind: 'clipboard' });
  });

  it('queries history/clipboard per tab and applies the machine filter immediately', async () => {
    const store = new SearchStore();
    store.setTab('history');
    await vi.advanceTimersByTimeAsync(0);
    expect(search).toHaveBeenLastCalledWith({ query: '', kind: 'history' });
    store.setMachine('beta');
    await vi.advanceTimersByTimeAsync(0);
    expect(search).toHaveBeenLastCalledWith({ query: '', kind: 'history', machine: 'beta' });
    store.setMachine('');
    await vi.advanceTimersByTimeAsync(0);
    expect(search).toHaveBeenLastCalledWith({ query: '', kind: 'history' });
    expect(store.machines()).toEqual(['alpha', 'beta']);
  });

  it('exposes entries, loading and the empty state', async () => {
    search.mockResolvedValueOnce({ entries: [entry('ls')] });
    const store = new SearchStore();
    store.refresh();
    expect(store.loading()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.loading()).toBe(false);
    expect(store.entries().map((e) => e.text)).toEqual(['ls']);
    search.mockResolvedValueOnce({ entries: [] });
    store.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.entries()).toEqual([]);
    expect(store.error()).toBe(false);
  });

  it('reports errors without throwing and recovers on the next refresh', async () => {
    search.mockRejectedValueOnce(new Error('IPC_INTERNAL'));
    const store = new SearchStore();
    store.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.error()).toBe(true);
    expect(store.loading()).toBe(false);
    search.mockResolvedValueOnce({ entries: [entry('pwd')] });
    store.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.error()).toBe(false);
    expect(store.entries()).toHaveLength(1);
  });

  it('ignores stale responses', async () => {
    let resolveFirst: (value: SearchQueryResult) => void = () => undefined;
    search.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)));
    search.mockResolvedValueOnce({ entries: [entry('new')] });
    const store = new SearchStore();
    store.refresh();
    store.refresh();
    await vi.advanceTimersByTimeAsync(0);
    resolveFirst({ entries: [entry('old')] });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.entries().map((e) => e.text)).toEqual(['new']);
  });

  it('refreshes on the sync-refreshed event and every 15 seconds', async () => {
    const store = new SearchStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(search).toHaveBeenCalledTimes(1);
    refreshed();
    await vi.advanceTimersByTimeAsync(0);
    expect(search).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(SEARCH_REFRESH_INTERVAL_MS);
    expect(search).toHaveBeenCalledTimes(3);
    store.stop();
    await vi.advanceTimersByTimeAsync(SEARCH_REFRESH_INTERVAL_MS * 2);
    expect(search).toHaveBeenCalledTimes(3);
  });

  it('copies through clipboardWrite and shows a transient notice', async () => {
    const store = new SearchStore();
    await store.copy('ls -la');
    expect(clipboardWrite).toHaveBeenCalledWith({ text: 'ls -la' });
    expect(store.notice()).toBe('Copied to clipboard');
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.notice()).toBeNull();
    clipboardWrite.mockRejectedValueOnce(new Error('x'));
    await store.copy('x');
    expect(store.notice()).toBe('Copy failed');
  });
  it('removes an entry locally after a successful delete and reports failures', async () => {
    const keep = entry('keep');
    const target = entry('delete me');
    search.mockResolvedValue({ entries: [target, keep] });
    const store = new SearchStore();
    store.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.entries()).toHaveLength(2);
    await store.remove(target);
    expect(searchRemove).toHaveBeenCalledWith({ kind: 'history', sessionDirectory: target.sessionDirectory, id: target.id });
    expect(store.entries().map((candidate) => candidate.text)).toEqual(['keep']);
    expect(store.notice()).toBe('Entry deleted');
    searchRemove.mockRejectedValueOnce(new Error('boom'));
    await store.remove(keep);
    expect(store.entries()).toHaveLength(1);
    expect(store.notice()).toBe('Delete failed');
  });
});

describe('SyncStatusStore', () => {
  const syncStatus = vi.fn<() => Promise<SyncStatusEvent>>();
  let emit: (status: SyncStatusEvent) => void = () => undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    syncStatus.mockReset().mockResolvedValue({ state: 'synced', remoteConfigured: true });
    vi.stubGlobal('smartTerminal', {
      syncStatus,
      onSyncStatus: (listener: (status: SyncStatusEvent) => void) => {
        emit = listener;
        return () => undefined;
      },
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('polls every 5 seconds and follows pushed events', async () => {
    const store = new SyncStatusStore();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(syncStatus).toHaveBeenCalledTimes(1);
    syncStatus.mockResolvedValue({ state: 'offline', remoteConfigured: true, lastError: 'x' });
    await vi.advanceTimersByTimeAsync(SYNC_STATUS_POLL_MS);
    expect(syncStatus).toHaveBeenCalledTimes(2);
    expect(store.badge()).toEqual({ state: 'offline', label: 'GitHub offline' });
    emit({ state: 'syncing', remoteConfigured: true });
    expect(store.badge().label).toBe('GitHub syncing…');
    store.stop();
  });

  it('keeps the previous status when the IPC call fails', async () => {
    const store = new SyncStatusStore();
    syncStatus.mockRejectedValue(new Error('IPC_INTERNAL'));
    store.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.status()).toEqual({ state: 'synced', remoteConfigured: true });
  });
});

describe('sidebar/footer helpers', () => {
  it('maps sync states to badges, "Repository not configured" without remote', () => {
    expect(syncBadge('synced', true)).toEqual({ state: 'synced', label: 'GitHub synced' });
    expect(syncBadge('dirty', true).state).toBe('syncing');
    expect(syncBadge('error', true)).toEqual({ state: 'error', label: 'GitHub sync error' });
    expect(syncBadge('synced', false)).toEqual({ state: 'unconfigured', label: 'Repository not configured' });
    expect(syncBadge('error', false).label).toBe('Repository not configured');
  });

  it('builds one-line previews and short timestamps', () => {
    expect(previewText('a\n  b\tc')).toBe('a b c');
    expect(previewText('x'.repeat(200))).toHaveLength(161);
    expect(shortTimestamp('2026-01-01T10:00:00+02:00')).toBe('2026-01-01 10:00:00');
  });

});
