import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type AppPingResult, type SmartTerminalApi } from '@smart-terminal/contracts';

const api: SmartTerminalApi = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.appPing) as Promise<AppPingResult>,
};

contextBridge.exposeInMainWorld('smartTerminal', api);
