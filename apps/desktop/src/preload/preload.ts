import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  TEST_IPC_ARGUMENT,
  type AppPingResult,
  type AppRuntimeInfo,
  type ClipboardCaptureState,
  type HistoryRecordResult,
  type SearchQueryResult,
  type TerminalDataEvent,
  type TerminalExitEvent,
  type TerminalSessionInfo,
  type Unsubscribe,
  type SmartTerminalApi,
} from '@smart-terminal/contracts';

function subscribe<T>(channel: string, listener: (event: T) => void): Unsubscribe {
  const wrapped = (_event: unknown, payload: T): void => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
}

const api: SmartTerminalApi = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.appPing) as Promise<AppPingResult>,
  runtimeInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appRuntimeInfo) as Promise<AppRuntimeInfo>,
  createTerminal: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.terminalCreate, request) as Promise<TerminalSessionInfo>,
  writeTerminal: (request) => ipcRenderer.invoke(IPC_CHANNELS.terminalWrite, request) as Promise<void>,
  resizeTerminal: (request) => ipcRenderer.invoke(IPC_CHANNELS.terminalResize, request) as Promise<void>,
  closeTerminal: (request) => ipcRenderer.invoke(IPC_CHANNELS.terminalClose, request) as Promise<void>,
  listTerminals: () => ipcRenderer.invoke(IPC_CHANNELS.terminalList) as Promise<TerminalSessionInfo[]>,
  recordHistory: (request) => ipcRenderer.invoke(IPC_CHANNELS.historyRecord, request) as Promise<HistoryRecordResult>,
  clipboardState: () => ipcRenderer.invoke(IPC_CHANNELS.clipboardState) as Promise<ClipboardCaptureState>,
  clipboardConfigure: (request) => ipcRenderer.invoke(IPC_CHANNELS.clipboardConfigure, request) as Promise<ClipboardCaptureState>,
  clipboardSetActive: (request) => ipcRenderer.invoke(IPC_CHANNELS.clipboardSetActive, request) as Promise<ClipboardCaptureState>,
  clipboardClear: () => ipcRenderer.invoke(IPC_CHANNELS.clipboardClear) as Promise<ClipboardCaptureState>,
  search: (request) => ipcRenderer.invoke(IPC_CHANNELS.searchQuery, request) as Promise<SearchQueryResult>,
  onTerminalData: (listener) => subscribe<TerminalDataEvent>(IPC_EVENTS.terminalData, listener),
  onTerminalExit: (listener) => subscribe<TerminalExitEvent>(IPC_EVENTS.terminalExit, listener),
};

contextBridge.exposeInMainWorld('smartTerminal', api);

/**
 * SEAM DI TEST: `__testInvoke` esiste solo se il main ha avviato la finestra con
 * `--smart-terminal-test-ipc` (SMART_TERMINAL_SMOKE=1 o SMART_TERMINAL_PTY_SMOKE=1). Permette di verificare il rifiuto di
 * canali sconosciuti/payload invalidi. In produzione non viene esposto alcun invoke generico.
 */
if (process.argv.includes(TEST_IPC_ARGUMENT)) {
  contextBridge.exposeInMainWorld('__testInvoke', (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),
  );
}
