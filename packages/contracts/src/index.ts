/**
 * Contratti condivisi tra main, preload e renderer.
 * Ogni canale IPC deve essere elencato qui e validato nel main.
 */
export const IPC_CHANNELS = {
  appPing: 'app:ping',
  appRuntimeInfo: 'app:runtime-info',
  terminalCreate: 'terminal:create',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalClose: 'terminal:close',
  terminalList: 'terminal:list',
  historyRecord: 'history:record',
  clipboardConfigure: 'clipboard:configure',
  clipboardSetActive: 'clipboard:set-active',
  clipboardClear: 'clipboard:clear',
  clipboardState: 'clipboard:state',
  searchQuery: 'search:query',
} as const;

/** Eventi main -> renderer (non invocabili dal renderer). */
export const IPC_EVENTS = {
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit',
} as const;

export const TERMINAL_MAX_WRITE_BYTES = 64 * 1024;
export const HISTORY_MAX_TEXT_BYTES = 16 * 1024;
export const HISTORY_MAX_AGENT_LENGTH = 64;
export const SEARCH_MAX_QUERY_LENGTH = 256;
export const TERMINAL_MIN_DIMENSION = 1;
export const TERMINAL_MAX_DIMENSION = 1000;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export interface AppPingResult {
  appVersion: string;
  platform: string;
}

export interface AppRuntimeInfo {
  appVersion: string;
  platform: string;
  isPackaged: boolean;
}

export interface TerminalCreateRequest {
  kind: 'local';
  cwd?: string;
  cols?: number;
  rows?: number;
}

export interface TerminalSessionInfo {
  /** Coincide con `label` (`S<n>`, progressivo per macchina). */
  sessionId: string;
  label: string;
  kind: 'local';
  pid: number;
  cwd: string;
  machine: string;
  /** Directory sessione relativa al repo dati: `sessions/<machine>/<dir>`. */
  sessionDirectory: string;
  /** ISO 8601 con offset. */
  startedAt: string;
}

export interface TerminalWriteRequest {
  sessionId: string;
  data: string;
}

export interface TerminalResizeRequest {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface TerminalCloseRequest {
  sessionId: string;
}

export interface TerminalDataEvent {
  sessionId: string;
  data: string;
}

export interface TerminalExitEvent {
  sessionId: string;
  exitCode: number;
  signal?: number;
}

/** Invio esplicito dall'editor assistito; la source è sempre `assisted` e viene fissata dal main. */
export interface HistoryRecordRequest {
  sessionId: string;
  text: string;
  agent?: string;
}

export interface HistoryRecordResult {
  recorded: boolean;
}

export interface ClipboardConfigureRequest {
  enabled: boolean;
  paused: boolean;
}

/** `null` quando non esiste una sessione attiva. */
export interface ClipboardSetActiveRequest {
  sessionId: string | null;
}

export interface ClipboardCaptureState {
  enabled: boolean;
  paused: boolean;
  /** ISO 8601 dell'ultimo evento clipboard scritto in questo processo. */
  lastEventAt: string | null;
}

export type SearchEntryKind = 'history' | 'clipboard';

export interface SearchQueryRequest {
  /** Sottostringa case-insensitive (anche vuota, per filtrare solo). */
  query: string;
  machine?: string;
  sessionId?: string;
  /** ISO 8601 con offset, inclusivo. */
  from?: string;
  /** ISO 8601 con offset, inclusivo. */
  to?: string;
  kind?: SearchEntryKind;
}

export interface SearchResultEntry {
  machine: string;
  sessionId: string;
  sessionDirectory: string;
  kind: SearchEntryKind;
  timestamp: string;
  text: string;
  source?: string;
  cwd?: string;
}

/** Al massimo 100 voci, ordinate per timestamp decrescente. */
export interface SearchQueryResult {
  entries: SearchResultEntry[];
}

export type Unsubscribe = () => void;

export interface SmartTerminalApi {
  ping(): Promise<AppPingResult>;
  runtimeInfo(): Promise<AppRuntimeInfo>;
  createTerminal(request: TerminalCreateRequest): Promise<TerminalSessionInfo>;
  writeTerminal(request: TerminalWriteRequest): Promise<void>;
  resizeTerminal(request: TerminalResizeRequest): Promise<void>;
  closeTerminal(request: TerminalCloseRequest): Promise<void>;
  listTerminals(): Promise<TerminalSessionInfo[]>;
  recordHistory(request: HistoryRecordRequest): Promise<HistoryRecordResult>;
  clipboardState(): Promise<ClipboardCaptureState>;
  clipboardConfigure(request: ClipboardConfigureRequest): Promise<ClipboardCaptureState>;
  clipboardSetActive(request: ClipboardSetActiveRequest): Promise<ClipboardCaptureState>;
  /** Azzera il dedupe in memoria (gli hash gia' scritti in clipboard.md restano dedupati). */
  clipboardClear(): Promise<ClipboardCaptureState>;
  search(request: SearchQueryRequest): Promise<SearchQueryResult>;
  onTerminalData(listener: (event: TerminalDataEvent) => void): Unsubscribe;
  onTerminalExit(listener: (event: TerminalExitEvent) => void): Unsubscribe;
}

/** Argomento di avvio che abilita il seam di test `__testInvoke` nel preload. */
export const TEST_IPC_ARGUMENT = '--smart-terminal-test-ipc';
