import {
  isIsoTimestamp,
  isValidMachine,
  parseSessionDirectoryName,
  type AllocateSessionRequest,
  type AllocatedSession,
  type SearchEntry,
  type SearchQuery,
} from '@smart-terminal/data';

export const PROTOCOL_VERSION = 1;
export const MAX_LINE_BYTES = 1024 * 1024;
export const MAX_SEARCH_QUERY_LENGTH = 256;
export const MAX_FIELD_LENGTH = 4096;

export type SyncState = 'synced' | 'dirty' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastError?: string;
  lastSyncAt?: string;
}

/** Stato sync completo pubblicato via RPC `sync.status`. */
export interface RemoteSyncStatus extends SyncStatus {
  remoteConfigured: boolean;
}

/** Stato della cattura clipboard posseduta dal primary. */
export interface ClipboardRpcState {
  enabled: boolean;
  paused: boolean;
  /** ISO 8601 dell'ultimo evento scritto dal primary. */
  lastEventAt: string | null;
}

export interface PingResult {
  pid: number;
  startedAt: string;
  role: 'primary';
}

/** Servizi esposti dal primary tramite RPC. */
export interface CoordinatorServices {
  allocate(request: AllocateSessionRequest): Promise<AllocatedSession>;
  searchQuery(query: SearchQuery): SearchEntry[];
  searchUpsert(sessionDirectory: string): void;
  searchRefresh(): void;
  /** Macchine presenti nell'indice, ordinate. */
  searchFacets(): string[];
  clipboardState(): ClipboardRpcState;
  clipboardConfigure(config: { enabled: boolean; paused: boolean }): ClipboardRpcState;
  /** `sessionDirectory` e' gia' validato come `sessions/<machine>/<dir>`; `null` ferma la cattura attiva. */
  clipboardSetActive(sessionDirectory: string | null): ClipboardRpcState;
  clipboardClear(): ClipboardRpcState;
  /** Sessione terminata: pruning del registry del primary (clipboard attiva), indice e dirty. */
  sessionEnd(sessionDirectory: string): void;
  syncStatus(): RemoteSyncStatus;
  /** Marca dirty: il sync parte dallo scheduler (debounce/max wait). */
  syncDirty(): void;
}

export interface RpcRequest {
  v: 1;
  id: string;
  method: string;
  params: Record<string, unknown>;
  token: string;
}

export type RpcErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'UNKNOWN_METHOD'
  | 'INVALID_PARAMS'
  | 'LINE_TOO_LONG'
  | 'SESSION_ID_INVALID_REQUEST'
  | 'SESSION_ID_LOCK_TIMEOUT'
  | 'SESSION_ID_EXHAUSTED'
  | 'INTERNAL';

export type RpcResponse =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: { code: RpcErrorCode; message: string } };

export const RPC_METHODS = [
  'ping',
  'session.allocate',
  'search.query',
  'search.upsert',
  'search.refresh',
  'search.facets',
  'clipboard.state',
  'clipboard.configure',
  'clipboard.setActive',
  'clipboard.clear',
  'session.end',
  'sync.status',
  'sync.dirty',
] as const;
export type RpcMethod = (typeof RPC_METHODS)[number];

export class RpcFailure extends Error {
  constructor(
    readonly code: RpcErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'RpcFailure';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function checkKeys(params: Record<string, unknown>, required: string[], optional: string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !(key in params)) || Object.keys(params).some((key) => !allowed.has(key))) {
    throw new RpcFailure('INVALID_PARAMS');
  }
}

const isBoundedString = (value: unknown, allowEmpty = false): value is string =>
  typeof value === 'string' && value.length <= MAX_FIELD_LENGTH && (allowEmpty || value.length > 0) && !value.includes('\0');

/** `sessions/<machine>/<directory di sessione>`: forma verificata, nessun accesso al filesystem. */
function isSessionDirectory(value: unknown): value is string {
  if (!isBoundedString(value)) return false;
  const segments = value.split('/');
  const [root, machine, directory] = segments;
  return (
    segments.length === 3 &&
    root === 'sessions' &&
    machine !== undefined &&
    isValidMachine(machine) &&
    directory !== undefined &&
    parseSessionDirectoryName(directory) !== null
  );
}

function parseAllocateParams(params: Record<string, unknown>): AllocateSessionRequest {
  checkKeys(params, ['windowId', 'kind', 'cwdInitial'], ['sshAlias']);
  const { windowId, kind, cwdInitial, sshAlias } = params;
  if (
    !isBoundedString(windowId) ||
    (kind !== 'local' && kind !== 'ssh') ||
    !isBoundedString(cwdInitial) ||
    (sshAlias !== undefined && !isBoundedString(sshAlias))
  ) {
    throw new RpcFailure('INVALID_PARAMS');
  }
  return sshAlias === undefined ? { windowId, kind, cwdInitial } : { windowId, kind, cwdInitial, sshAlias };
}

function parseSearchParams(params: Record<string, unknown>): SearchQuery {
  checkKeys(params, ['query'], ['machine', 'sessionId', 'from', 'to', 'kind']);
  const { query, machine, sessionId, from, to, kind } = params;
  const optionalIso = (value: unknown): boolean => value === undefined || (typeof value === 'string' && isIsoTimestamp(value));
  if (
    typeof query !== 'string' ||
    query.length > MAX_SEARCH_QUERY_LENGTH ||
    (machine !== undefined && !(typeof machine === 'string' && isValidMachine(machine))) ||
    (sessionId !== undefined && !(typeof sessionId === 'string' && /^S[1-9][0-9]*$/.test(sessionId))) ||
    !optionalIso(from) ||
    !optionalIso(to) ||
    (kind !== undefined && kind !== 'history' && kind !== 'clipboard')
  ) {
    throw new RpcFailure('INVALID_PARAMS');
  }
  const result: SearchQuery = { query };
  if (machine !== undefined) result.machine = machine as string;
  if (sessionId !== undefined) result.sessionId = sessionId as string;
  if (from !== undefined) result.from = from as string;
  if (to !== undefined) result.to = to as string;
  if (kind !== undefined) result.kind = kind as 'history' | 'clipboard';
  return result;
}

/** Valida la riga JSON e restituisce la richiesta, senza controllare il token. */
export function parseRequestLine(line: string): RpcRequest {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new RpcFailure('INVALID_REQUEST');
  }
  if (
    !isRecord(value) ||
    value['v'] !== PROTOCOL_VERSION ||
    typeof value['id'] !== 'string' ||
    value['id'].length === 0 ||
    value['id'].length > 128 ||
    typeof value['method'] !== 'string' ||
    typeof value['token'] !== 'string' ||
    !isRecord(value['params'])
  ) {
    throw new RpcFailure('INVALID_REQUEST');
  }
  return value as unknown as RpcRequest;
}

export function isRpcMethod(method: string): method is RpcMethod {
  return (RPC_METHODS as readonly string[]).includes(method);
}

/** Esegue un metodo whitelisted. I `params` sono validati rigorosamente prima di toccare i servizi. */
export async function dispatchRpc(
  method: string,
  params: Record<string, unknown>,
  services: CoordinatorServices,
  info: { startedAt: string; pid: number },
): Promise<unknown> {
  if (!isRpcMethod(method)) {
    throw new RpcFailure('UNKNOWN_METHOD');
  }
  switch (method) {
    case 'ping':
      checkKeys(params, []);
      return { pid: info.pid, startedAt: info.startedAt, role: 'primary' } satisfies PingResult;
    case 'session.allocate':
      return services.allocate(parseAllocateParams(params));
    case 'search.query':
      return { entries: services.searchQuery(parseSearchParams(params)) };
    case 'search.upsert': {
      checkKeys(params, ['sessionDirectory']);
      if (!isBoundedString(params['sessionDirectory'])) {
        throw new RpcFailure('INVALID_PARAMS');
      }
      services.searchUpsert(params['sessionDirectory']);
      return { ok: true };
    }
    case 'search.refresh':
      checkKeys(params, []);
      services.searchRefresh();
      return { ok: true };
    case 'search.facets':
      checkKeys(params, []);
      return { machines: services.searchFacets() };
    case 'clipboard.state':
      checkKeys(params, []);
      return services.clipboardState();
    case 'clipboard.configure': {
      checkKeys(params, ['enabled', 'paused']);
      const { enabled, paused } = params;
      if (typeof enabled !== 'boolean' || typeof paused !== 'boolean') {
        throw new RpcFailure('INVALID_PARAMS');
      }
      return services.clipboardConfigure({ enabled, paused });
    }
    case 'clipboard.setActive': {
      checkKeys(params, ['sessionDirectory']);
      const directory = params['sessionDirectory'];
      if (directory !== null && !isSessionDirectory(directory)) {
        throw new RpcFailure('INVALID_PARAMS');
      }
      return services.clipboardSetActive(directory);
    }
    case 'clipboard.clear':
      checkKeys(params, []);
      return services.clipboardClear();
    case 'session.end': {
      checkKeys(params, ['sessionDirectory']);
      const directory = params['sessionDirectory'];
      if (!isSessionDirectory(directory)) {
        throw new RpcFailure('INVALID_PARAMS');
      }
      services.sessionEnd(directory);
      return { ok: true };
    }
    case 'sync.status':
      checkKeys(params, []);
      return services.syncStatus();
    case 'sync.dirty':
      checkKeys(params, []);
      services.syncDirty();
      return { ok: true };
  }
}

const KNOWN_FAILURE_CODES: readonly string[] = ['SESSION_ID_INVALID_REQUEST', 'SESSION_ID_LOCK_TIMEOUT', 'SESSION_ID_EXHAUSTED'];

/** Trasforma qualsiasi errore in una risposta sanificata: mai stack, path o messaggi interni. */
export function sanitizeError(error: unknown): { code: RpcErrorCode; message: string } {
  const code = (error as { code?: unknown } | null)?.code;
  if (error instanceof RpcFailure) {
    return { code: error.code, message: error.code };
  }
  if (typeof code === 'string' && KNOWN_FAILURE_CODES.includes(code)) {
    return { code: code as RpcErrorCode, message: code };
  }
  return { code: 'INTERNAL', message: 'Internal coordinator error' };
}
