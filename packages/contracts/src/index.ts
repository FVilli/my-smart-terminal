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
} as const;

/** Eventi main -> renderer (non invocabili dal renderer). */
export const IPC_EVENTS = {
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit',
} as const;

export const TERMINAL_MAX_WRITE_BYTES = 64 * 1024;
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
  sessionId: string;
  kind: 'local';
  pid: number;
  cwd: string;
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

export type Unsubscribe = () => void;

export interface SmartTerminalApi {
  ping(): Promise<AppPingResult>;
  runtimeInfo(): Promise<AppRuntimeInfo>;
  createTerminal(request: TerminalCreateRequest): Promise<TerminalSessionInfo>;
  writeTerminal(request: TerminalWriteRequest): Promise<void>;
  resizeTerminal(request: TerminalResizeRequest): Promise<void>;
  closeTerminal(request: TerminalCloseRequest): Promise<void>;
  listTerminals(): Promise<TerminalSessionInfo[]>;
  onTerminalData(listener: (event: TerminalDataEvent) => void): Unsubscribe;
  onTerminalExit(listener: (event: TerminalExitEvent) => void): Unsubscribe;
}

/** Argomento di avvio che abilita il seam di test `__testInvoke` nel preload. */
export const TEST_IPC_ARGUMENT = '--smart-terminal-test-ipc';
