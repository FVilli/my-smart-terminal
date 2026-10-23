/**
 * Contratti condivisi tra main, preload e renderer.
 * Ogni canale IPC deve essere elencato qui e validato nel main.
 */
export const IPC_CHANNELS = {
  appPing: 'app:ping',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export interface AppPingResult {
  appVersion: string;
  platform: string;
}

export interface SmartTerminalApi {
  ping(): Promise<AppPingResult>;
}
