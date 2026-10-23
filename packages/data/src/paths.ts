import fs from 'node:fs';
import path from 'node:path';

export type SessionPathErrorCode =
  | 'PATH_INVALID_MACHINE'
  | 'PATH_INVALID_DESTINATION'
  | 'PATH_INVALID_SEQUENCE'
  | 'PATH_INVALID_TIMESTAMP'
  | 'PATH_INVALID_DIRECTORY'
  | 'PATH_TRAVERSAL';

export class SessionPathError extends Error {
  constructor(readonly code: SessionPathErrorCode) {
    super(code);
    this.name = 'SessionPathError';
  }
}

export const MAX_MACHINE_LENGTH = 64;
export const MAX_DESTINATION_LENGTH = 48;
export const SESSIONS_DIRECTORY = 'sessions';
export const SESSION_FILE_NAMES = { session: 'session.md', history: 'history.md', clipboard: 'clipboard.md' } as const;
export const COUNTER_FILE_NAME = 'counter.md';

const SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const DIRECTORY_PATTERN = /^(\d{4}-\d{2}-\d{2}_\d{2}\.\d{2})_S([1-9][0-9]*)_(.+)$/;

function normalizeSegment(raw: string, maxLength: number, fallback: string): string {
  const normalized = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, maxLength)
    .replace(/[^a-z0-9]+$/, '');
  return normalized.length > 0 ? normalized : fallback;
}

/** Normalizes a hostname into a safe path segment (lowercase, no slashes, `.`/`..`, max 64). */
export function normalizeMachine(hostname: string): string {
  return normalizeSegment(hostname, MAX_MACHINE_LENGTH, 'unknown-machine');
}

/** Normalizes `local` or an SSH alias into a safe path segment (max 48). */
export function normalizeDestination(destination: string): string {
  return normalizeSegment(destination, MAX_DESTINATION_LENGTH, 'unknown-destination');
}

export function isValidMachine(value: string): boolean {
  return value.length <= MAX_MACHINE_LENGTH && SEGMENT_PATTERN.test(value) && !value.includes('..');
}

export function isValidDestination(value: string): boolean {
  return value.length <= MAX_DESTINATION_LENGTH && SEGMENT_PATTERN.test(value) && !value.includes('..');
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/** Local timestamp for the directory name: `YYYY-MM-DD_HH.mm`. */
export function formatLocalTimestamp(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new SessionPathError('PATH_INVALID_TIMESTAMP');
  }
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}.${pad(date.getMinutes())}`;
}

/** Local ISO 8601 timestamp with offset (`2026-10-22T10:05:03+02:00`), with second precision. */
export function formatIsoWithOffset(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new SessionPathError('PATH_INVALID_TIMESTAMP');
  }
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return (
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export const ISO_WITH_OFFSET_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function isIsoTimestamp(value: string): boolean {
  return ISO_WITH_OFFSET_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

export function formatSessionLabel(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new SessionPathError('PATH_INVALID_SEQUENCE');
  }
  return `S${sequence}`;
}

export function parseSessionLabel(label: string): number | null {
  const match = /^S([1-9][0-9]*)$/.exec(label);
  if (match === null) {
    return null;
  }
  const sequence = Number(match[1]);
  return Number.isSafeInteger(sequence) ? sequence : null;
}

export interface SessionDirectoryParts {
  timestamp: string;
  sequence: number;
  destination: string;
}

/** `YYYY-MM-DD_HH.mm_S<n>_<local|alias>` */
export function buildSessionDirectoryName(startedAt: Date, sequence: number, destination: string): string {
  if (!isValidDestination(destination)) {
    throw new SessionPathError('PATH_INVALID_DESTINATION');
  }
  return `${formatLocalTimestamp(startedAt)}_${formatSessionLabel(sequence)}_${destination}`;
}

export function parseSessionDirectoryName(name: string): SessionDirectoryParts | null {
  const match = DIRECTORY_PATTERN.exec(name);
  if (match === null) {
    return null;
  }
  const sequence = Number(match[2]);
  const destination = match[3] ?? '';
  if (!Number.isSafeInteger(sequence) || !isValidDestination(destination)) {
    return null;
  }
  return { timestamp: match[1] ?? '', sequence, destination };
}

/** Data-repository-relative path using `/` as the separator: `sessions/<machine>/<directory>`. */
export function buildSessionRelativeDir(machine: string, startedAt: Date, sequence: number, destination: string): string {
  if (!isValidMachine(machine)) {
    throw new SessionPathError('PATH_INVALID_MACHINE');
  }
  return `${SESSIONS_DIRECTORY}/${machine}/${buildSessionDirectoryName(startedAt, sequence, destination)}`;
}

export function machineDirectory(dataRepoPath: string, machine: string): string {
  if (!isValidMachine(machine)) {
    throw new SessionPathError('PATH_INVALID_MACHINE');
  }
  return path.join(dataRepoPath, SESSIONS_DIRECTORY, machine);
}

/** Resolves a relative path inside `root`; rejects absolute paths and traversal. */
export function resolveInside(root: string, relative: string): string {
  const base = path.resolve(root);
  const resolved = path.resolve(base, relative);
  if (path.isAbsolute(relative) || (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) || resolved === base) {
    throw new SessionPathError('PATH_TRAVERSAL');
  }
  return resolved;
}

export interface SessionFilePaths {
  sessionFile: string;
  historyFile: string;
  clipboardFile: string;
}

export function sessionFilePaths(absoluteDir: string): SessionFilePaths {
  return {
    sessionFile: path.join(absoluteDir, SESSION_FILE_NAMES.session),
    historyFile: path.join(absoluteDir, SESSION_FILE_NAMES.history),
    clipboardFile: path.join(absoluteDir, SESSION_FILE_NAMES.clipboard),
  };
}

/** Rejects symlink components below the root: a symlink in sessions/ must not escape writes. */
export function assertNoSymlinkComponents(root: string, relative: string): void {
  const base = path.resolve(root);
  let current = base;
  for (const segment of relative.split(/[\\/]+/)) {
    if (segment.length === 0) continue;
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new SessionPathError('PATH_TRAVERSAL');
      }
    } catch (error) {
      if (error instanceof SessionPathError) throw error;
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new SessionPathError('PATH_TRAVERSAL');
    }
  }
}

/** Validates a session-relative path and resolves it inside the data repository. */
export function resolveSessionDirectory(dataRepoPath: string, relativeDir: string): string {
  const segments = relativeDir.split('/');
  const [root, machine, directory] = segments;
  if (
    segments.length !== 3 ||
    root !== SESSIONS_DIRECTORY ||
    machine === undefined ||
    directory === undefined ||
    !isValidMachine(machine) ||
    parseSessionDirectoryName(directory) === null
  ) {
    throw new SessionPathError(relativeDir.includes('..') ? 'PATH_TRAVERSAL' : 'PATH_INVALID_DIRECTORY');
  }
  const resolved = resolveInside(dataRepoPath, relativeDir);
  assertNoSymlinkComponents(dataRepoPath, relativeDir);
  return resolved;
}
