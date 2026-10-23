/**
 * Framework puro (senza dipendenze da Electron) per handler IPC validati.
 * Il binding con ipcMain vive in ipc-electron.ts.
 */
import {
  IPC_CHANNELS,
  TERMINAL_MAX_DIMENSION,
  TERMINAL_MAX_WRITE_BYTES,
  TERMINAL_MIN_DIMENSION,
  type AppPingResult,
  type AppRuntimeInfo,
  type IpcChannel,
  type TerminalCloseRequest,
  type TerminalCreateRequest,
  type TerminalResizeRequest,
  type TerminalSessionInfo,
  type TerminalWriteRequest,
} from '@smart-terminal/contracts';
import { TerminalError } from '@smart-terminal/terminal';

export const MAX_PAYLOAD_BYTES = 128 * 1024;

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
  handle(sender: SenderInfo, ...args: Args): Result | Promise<Result>;
}

export interface RuntimeEnvironment {
  appVersion: string;
  platform: string;
  isPackaged: boolean;
}

export const noArguments = (args: unknown[]): args is [] => args.length === 0;

/** Operazioni terminale legate alla finestra (senderId) che le richiede. */
export interface TerminalGateway {
  create(senderId: number, request: TerminalCreateRequest): TerminalSessionInfo;
  write(senderId: number, sessionId: string, data: string): void;
  resize(senderId: number, sessionId: string, cols: number, rows: number): void;
  close(senderId: number, sessionId: string): void;
  list(senderId: number): TerminalSessionInfo[];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function hasExactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key));
}

const isDimension = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= TERMINAL_MIN_DIMENSION &&
  value <= TERMINAL_MAX_DIMENSION;

const isSessionId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 128;

function singleRequest<T>(check: (value: Record<string, unknown>) => boolean) {
  return (args: unknown[]): args is [T] => args.length === 1 && isPlainRecord(args[0]) && check(args[0]);
}

export const validateTerminalCreate = singleRequest<TerminalCreateRequest>(
  (v) =>
    hasExactKeys(v, ['kind'], ['cwd', 'cols', 'rows']) &&
    v['kind'] === 'local' &&
    (v['cwd'] === undefined || (typeof v['cwd'] === 'string' && v['cwd'].length > 0 && v['cwd'].length <= 4096)) &&
    (v['cols'] === undefined || isDimension(v['cols'])) &&
    (v['rows'] === undefined || isDimension(v['rows'])),
);

export const validateTerminalWrite = singleRequest<TerminalWriteRequest>(
  (v) =>
    hasExactKeys(v, ['sessionId', 'data']) &&
    isSessionId(v['sessionId']) &&
    typeof v['data'] === 'string' &&
    Buffer.byteLength(v['data'], 'utf8') <= TERMINAL_MAX_WRITE_BYTES,
);

export const validateTerminalResize = singleRequest<TerminalResizeRequest>(
  (v) => hasExactKeys(v, ['sessionId', 'cols', 'rows']) && isSessionId(v['sessionId']) && isDimension(v['cols']) && isDimension(v['rows']),
);

export const validateTerminalClose = singleRequest<TerminalCloseRequest>(
  (v) => hasExactKeys(v, ['sessionId']) && isSessionId(v['sessionId']),
);

export interface IpcChannelMap {
  [IPC_CHANNELS.appPing]: ChannelDefinition<[], AppPingResult>;
  [IPC_CHANNELS.appRuntimeInfo]: ChannelDefinition<[], AppRuntimeInfo>;
  [IPC_CHANNELS.terminalCreate]: ChannelDefinition<[TerminalCreateRequest], TerminalSessionInfo>;
  [IPC_CHANNELS.terminalWrite]: ChannelDefinition<[TerminalWriteRequest], void>;
  [IPC_CHANNELS.terminalResize]: ChannelDefinition<[TerminalResizeRequest], void>;
  [IPC_CHANNELS.terminalClose]: ChannelDefinition<[TerminalCloseRequest], void>;
  [IPC_CHANNELS.terminalList]: ChannelDefinition<[], TerminalSessionInfo[]>;
}

export function createChannelMap(env: RuntimeEnvironment, terminals: TerminalGateway): IpcChannelMap {
  return {
    [IPC_CHANNELS.appPing]: {
      validate: noArguments,
      handle: () => ({ appVersion: env.appVersion, platform: env.platform }),
    },
    [IPC_CHANNELS.appRuntimeInfo]: {
      validate: noArguments,
      handle: () => ({ appVersion: env.appVersion, platform: env.platform, isPackaged: env.isPackaged }),
    },
    [IPC_CHANNELS.terminalCreate]: {
      validate: validateTerminalCreate,
      handle: (sender, request) => terminals.create(sender.senderId, request),
    },
    [IPC_CHANNELS.terminalWrite]: {
      validate: validateTerminalWrite,
      handle: (sender, { sessionId, data }) => terminals.write(sender.senderId, sessionId, data),
    },
    [IPC_CHANNELS.terminalResize]: {
      validate: validateTerminalResize,
      handle: (sender, { sessionId, cols, rows }) => terminals.resize(sender.senderId, sessionId, cols, rows),
    },
    [IPC_CHANNELS.terminalClose]: {
      validate: validateTerminalClose,
      handle: (sender, { sessionId }) => terminals.close(sender.senderId, sessionId),
    },
    [IPC_CHANNELS.terminalList]: {
      validate: noArguments,
      handle: (sender) => terminals.list(sender.senderId),
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
    return await def.handle(sender, ...args);
  } catch (error) {
    if (error instanceof TerminalError) {
      throw new Error(error.code);
    }
    throw new IpcError('IPC_INTERNAL');
  }
}

export function isApprovedChannel(channels: IpcChannelMap, channel: string): channel is IpcChannel {
  return Object.prototype.hasOwnProperty.call(channels, channel);
}
