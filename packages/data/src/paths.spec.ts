import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildSessionDirectoryName,
  buildSessionRelativeDir,
  formatIsoWithOffset,
  formatLocalTimestamp,
  isIsoTimestamp,
  normalizeDestination,
  normalizeMachine,
  parseSessionDirectoryName,
  resolveInside,
  resolveSessionDirectory,
  sessionFilePaths,
} from './paths';

describe('paths', () => {
  it('normalizes machine names', () => {
    expect(normalizeMachine('My-Laptop.local')).toBe('my-laptop.local');
    expect(normalizeMachine('../../etc/passwd')).toBe('etc-passwd');
    expect(normalizeMachine('..')).toBe('unknown-machine');
    expect(normalizeMachine('.')).toBe('unknown-machine');
    expect(normalizeMachine('Città Å/x\\y')).toBe('citta-a-x-y');
    expect(normalizeMachine('a'.repeat(200))).toHaveLength(64);
    expect(normalizeMachine('')).toBe('unknown-machine');
    expect(normalizeMachine('a..b')).toBe('a.b');
  });

  it('normalizes destinations', () => {
    expect(normalizeDestination('local')).toBe('local');
    expect(normalizeDestination('Prod/Server 1')).toBe('prod-server-1');
    expect(normalizeDestination('x'.repeat(100))).toHaveLength(48);
  });

  it('formats local timestamp and ISO with offset', () => {
    const date = new Date(2026, 9, 22, 9, 5, 3);
    expect(formatLocalTimestamp(date)).toBe('2026-10-22_09.05');
    const iso = formatIsoWithOffset(date);
    expect(iso).toMatch(/^2026-10-22T09:05:03[+-]\d{2}:\d{2}$/);
    expect(isIsoTimestamp(iso)).toBe(true);
    expect(new Date(iso).getTime()).toBe(date.getTime());
    expect(isIsoTimestamp('2026-10-22 09:05')).toBe(false);
    expect(() => formatLocalTimestamp(new Date(Number.NaN))).toThrow();
  });

  it('builds and parses session directory names', () => {
    const date = new Date(2026, 0, 2, 3, 4);
    const name = buildSessionDirectoryName(date, 12, 'local');
    expect(name).toBe('2026-01-02_03.04_S12_local');
    expect(parseSessionDirectoryName(name)).toEqual({ timestamp: '2026-01-02_03.04', sequence: 12, destination: 'local' });
    expect(parseSessionDirectoryName('2026-01-02_03.04_S0_local')).toBeNull();
    expect(parseSessionDirectoryName('2026-01-02_03.04_S1_../x')).toBeNull();
    expect(parseSessionDirectoryName('counter.md')).toBeNull();
    expect(buildSessionRelativeDir('host', date, 1, 'my_alias')).toBe('sessions/host/2026-01-02_03.04_S1_my_alias');
    expect(() => buildSessionDirectoryName(date, 0, 'local')).toThrow();
    expect(() => buildSessionDirectoryName(date, 1, '../x')).toThrow();
    expect(() => buildSessionRelativeDir('../x', date, 1, 'local')).toThrow();
  });

  it('builds the three file paths and rejects traversal', () => {
    expect(sessionFilePaths('/r/d')).toEqual({
      sessionFile: path.join('/r/d', 'session.md'),
      historyFile: path.join('/r/d', 'history.md'),
      clipboardFile: path.join('/r/d', 'clipboard.md'),
    });
    expect(() => resolveInside('/r', '../x')).toThrow(expect.objectContaining({ code: 'PATH_TRAVERSAL' }));
    expect(() => resolveInside('/r', '/etc')).toThrow(expect.objectContaining({ code: 'PATH_TRAVERSAL' }));
    expect(resolveInside('/r', 'a/b')).toBe(path.join('/r', 'a', 'b'));
    expect(resolveSessionDirectory('/r', 'sessions/host/2026-01-02_03.04_S1_local')).toBe(
      path.join('/r', 'sessions', 'host', '2026-01-02_03.04_S1_local'),
    );
    expect(() => resolveSessionDirectory('/r', 'sessions/../x/2026-01-02_03.04_S1_local')).toThrow(expect.objectContaining({ code: 'PATH_TRAVERSAL' }));
    expect(() => resolveSessionDirectory('/r', 'sessions/host/other')).toThrow(expect.objectContaining({ code: 'PATH_INVALID_DIRECTORY' }));
  });
});
