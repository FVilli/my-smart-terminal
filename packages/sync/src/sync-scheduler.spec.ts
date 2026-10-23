import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncScheduler, type SyncSchedulerOptions } from './sync-scheduler';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function make(overrides: Partial<SyncSchedulerOptions> = {}) {
  const sync = vi.fn(async () => undefined);
  const fetch = vi.fn(async () => undefined);
  const scheduler = new SyncScheduler({ sync, fetch, ...overrides });
  return { scheduler, sync, fetch };
}

describe('SyncScheduler debounce', () => {
  it('syncs once 10 s after a single dirty', async () => {
    const { scheduler, sync } = make();
    scheduler.notifyDirty();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(sync).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('restarts the debounce on each dirty: 0, 5 s, 9 s => a single sync at 19 s', async () => {
    const { scheduler, sync } = make();
    scheduler.notifyDirty();
    await vi.advanceTimersByTimeAsync(5_000);
    scheduler.notifyDirty();
    await vi.advanceTimersByTimeAsync(4_000);
    scheduler.notifyDirty();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(sync).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('forces a sync at 60 s of continuous activity', async () => {
    const { scheduler, sync } = make();
    for (let t = 0; t < 60_000; t += 5_000) {
      scheduler.notifyDirty();
      await vi.advanceTimersByTimeAsync(5_000);
    }
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('honours custom timings', async () => {
    const { scheduler, sync } = make({ debounceMs: 100, maxWaitMs: 1000 });
    scheduler.notifyDirty();
    await vi.advanceTimersByTimeAsync(100);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('never syncs without dirty', async () => {
    const { scheduler, sync } = make();
    scheduler.start();
    await scheduler.flush();
    await vi.advanceTimersByTimeAsync(200_000);
    expect(sync).not.toHaveBeenCalled();
    await scheduler.stop();
  });
});

describe('SyncScheduler coalescing and flush', () => {
  it('runs a single extra pass for dirty notifications arriving during a sync, never concurrently', async () => {
    let release: () => void = () => undefined;
    let active = 0;
    let maxActive = 0;
    const sync = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      active -= 1;
    });
    const { scheduler } = make({ sync });
    scheduler.notifyDirty();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sync).toHaveBeenCalledTimes(1);
    scheduler.notifyDirty();
    scheduler.notifyDirty();
    await vi.advanceTimersByTimeAsync(70_000);
    expect(sync).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(2);
    release();
    await vi.advanceTimersByTimeAsync(0);
    await scheduler.stop();
    expect(sync).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
  });

  it('flush syncs immediately a pending dirty and cancels the debounce', async () => {
    const { scheduler, sync } = make();
    scheduler.notifyDirty();
    await scheduler.flush();
    expect(sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('flush waits for a sync in progress', async () => {
    let release: () => void = () => undefined;
    const sync = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const { scheduler } = make({ sync });
    scheduler.notifyDirty();
    await vi.advanceTimersByTimeAsync(10_000);
    let done = false;
    void scheduler.flush().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it('stop cancels timers, waits for the running sync and ignores later dirty', async () => {
    const { scheduler, sync, fetch } = make();
    scheduler.start();
    scheduler.notifyDirty();
    await scheduler.stop();
    scheduler.notifyDirty();
    await vi.advanceTimersByTimeAsync(200_000);
    expect(sync).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('SyncScheduler fetch polling', () => {
  it('fetches every 15 s after start and stop cancels it', async () => {
    const { scheduler, fetch, sync } = make();
    scheduler.start();
    await vi.advanceTimersByTimeAsync(14_999);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetch).toHaveBeenCalledTimes(3);
    await scheduler.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sync).not.toHaveBeenCalled();
  });

  it('skips the fetch while a sync is running', async () => {
    let release: () => void = () => undefined;
    const sync = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const { scheduler, fetch } = make({ sync, debounceMs: 1_000 });
    scheduler.start();
    scheduler.notifyDirty();
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetch).not.toHaveBeenCalled();
    release();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await scheduler.stop();
  });

  it('errors from fetch and sync are reported and do not stop the timers', async () => {
    const onError = vi.fn();
    const onStatus = vi.fn();
    const fetch = vi.fn(async () => { throw new Error('boom'); });
    const sync = vi.fn(async () => { throw new Error('bang'); });
    const { scheduler } = make({ fetch, sync, onError, onStatus });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(45_000);
    expect(fetch).toHaveBeenCalledTimes(3);
    scheduler.notifyDirty();
    await vi.advanceTimersByTimeAsync(10_000);
    scheduler.notifyDirty();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls.map((c) => c[1])).toEqual(['fetch', 'fetch', 'fetch', 'sync', 'fetch', 'sync']);
    expect(onStatus).not.toHaveBeenCalled();
    await scheduler.stop();
  });

  it('reports successful results through onStatus', async () => {
    const onStatus = vi.fn();
    const { scheduler } = make({ onStatus, sync: async () => 'S' });
    scheduler.notifyDirty();
    await scheduler.flush();
    expect(onStatus).toHaveBeenCalledWith({ kind: 'sync', result: 'S' });
  });
});
