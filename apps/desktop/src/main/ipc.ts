/**
 * Framework puro (senza dipendenze da Electron) per handler IPC validati.
 * Il binding con ipcMain vive in ipc-electron.ts.
 */
import { IPC_CHANNELS, type AppPingResult, type AppRuntimeInfo, type IpcChannel } from '@smart-terminal/contracts';

export const MAX_PAYLOAD_BYTES = 64 * 1024;

export class IpcError extends Error {
  constructor(readonly code: 'IPC_INVALID_SENDER' | 'IPC_INVALID_PAYLOAD' | 'IPC_PAYLOAD_TOO_LARGE' | 'IPC_INTERNAL') {
    super(code);
    this.name = 'IpcError';
  }
}

export interface SenderInfo {
  senderId: number;
  isMainFrame: boolean;
  frameUrl: string;
}

export interface SenderPolicy {
  expectedSenderIds: ReadonlySet<number>;
  devServerUrl: string | undefined;
  appOrigin: string; // es. smart-terminal://bundle/
}

export function isSenderAllowed(sender: SenderInfo, policy: SenderPolicy): boolean {
  if (!policy.expectedSenderIds.has(sender.senderId) || !sender.isMainFrame) {
    return false;
  }
  if (policy.devServerUrl) {
    try {
      return new URL(sender.frameUrl).origin === new URL(policy.devServerUrl).origin;
    } catch {
      return false;
    }
  }
  return sender.frameUrl.startsWith(policy.appOrigin);
}

export interface ChannelDefinition<Args extends unknown[], Result> {
  /** Valida gli argomenti grezzi; deve lanciare o restituire false se invalidi. */
  validate(args: unknown[]): args is Args;
  handle(...args: Args): Result | Promise<Result>;
}

export interface RuntimeEnvironment {
  appVersion: string;
  platform: string;
  isPackaged: boolean;
}

export const noArguments = (args: unknown[]): args is [] => args.length === 0;

export interface IpcChannelMap {
  [IPC_CHANNELS.appPing]: ChannelDefinition<[], AppPingResult>;
  [IPC_CHANNELS.appRuntimeInfo]: ChannelDefinition<[], AppRuntimeInfo>;
}

export function createChannelMap(env: RuntimeEnvironment): IpcChannelMap {
  return {
    [IPC_CHANNELS.appPing]: {
      validate: noArguments,
      handle: () => ({ appVersion: env.appVersion, platform: env.platform }),
    },
    [IPC_CHANNELS.appRuntimeInfo]: {
      validate: noArguments,
      handle: () => ({ appVersion: env.appVersion, platform: env.platform, isPackaged: env.isPackaged }),
    },
  };
}

function checkPayloadSize(args: unknown[]): void {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(args);
  } catch {
    throw new IpcError('IPC_INVALID_PAYLOAD');
  }
  if (serialized !== undefined && Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
    throw new IpcError('IPC_PAYLOAD_TOO_LARGE');
  }
}

/**
 * Esegue un canale: sender -> dimensione -> validazione -> handler.
 * Gli errori non-IpcError vengono mascherati come IPC_INTERNAL.
 */
export async function dispatchIpc(
  definition: ChannelDefinition<never[], unknown> | ChannelDefinition<unknown[], unknown>,
  sender: SenderInfo,
  policy: SenderPolicy,
  args: unknown[],
): Promise<unknown> {
  if (!isSenderAllowed(sender, policy)) {
    throw new IpcError('IPC_INVALID_SENDER');
  }
  checkPayloadSize(args);
  const def = definition as ChannelDefinition<unknown[], unknown>;
  let valid = false;
  try {
    valid = def.validate(args);
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new IpcError('IPC_INVALID_PAYLOAD');
  }
  try {
    return await def.handle(...args);
  } catch {
    throw new IpcError('IPC_INTERNAL');
  }
}

export function isApprovedChannel(channels: IpcChannelMap, channel: string): channel is IpcChannel {
  return Object.prototype.hasOwnProperty.call(channels, channel);
}
