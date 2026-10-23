import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  TEST_IPC_ARGUMENT,
  type AppPingResult,
  type AppRuntimeInfo,
  type SmartTerminalApi,
} from '@smart-terminal/contracts';

const api: SmartTerminalApi = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.appPing) as Promise<AppPingResult>,
  runtimeInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appRuntimeInfo) as Promise<AppRuntimeInfo>,
};

contextBridge.exposeInMainWorld('smartTerminal', api);

/**
 * SEAM DI TEST: `__testInvoke` esiste solo se il main ha avviato la finestra con
 * `--smart-terminal-test-ipc` (SMART_TERMINAL_SMOKE=1). Permette di verificare il rifiuto di
 * canali sconosciuti/payload invalidi. In produzione non viene esposto alcun invoke generico.
 */
if (process.argv.includes(TEST_IPC_ARGUMENT)) {
  contextBridge.exposeInMainWorld('__testInvoke', (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),
  );
}
