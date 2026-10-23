/**
 * Contratti condivisi tra main, preload e renderer.
 * Ogni canale IPC deve essere elencato qui e validato nel main.
 */
export const IPC_CHANNELS = {
  appPing: 'app:ping',
  appRuntimeInfo: 'app:runtime-info',
} as const;

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

export interface SmartTerminalApi {
  ping(): Promise<AppPingResult>;
  runtimeInfo(): Promise<AppRuntimeInfo>;
}

/** Argomento di avvio che abilita il seam di test `__testInvoke` nel preload. */
export const TEST_IPC_ARGUMENT = '--smart-terminal-test-ipc';
