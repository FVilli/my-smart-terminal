import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@smart-terminal/contracts';
import {
  MAX_PAYLOAD_BYTES,
  createChannelMap,
  dispatchIpc,
  isApprovedChannel,
  isSenderAllowed,
  type SenderInfo,
  type SenderPolicy,
  type TerminalGateway,
} from './ipc';

const env = { appVersion: '1.2.3', platform: 'linux', isPackaged: false };
const gateway: TerminalGateway = {
  create: vi.fn((_id, request) => ({ sessionId: 's1', kind: request.kind, pid: 1, cwd: '/tmp' })),
  write: vi.fn(),
  resize: vi.fn(),
  close: vi.fn(),
  list: vi.fn(() => []),
};
const channels = createChannelMap(env, gateway);
const policy: SenderPolicy = { expectedSenderIds: new Set([7]), devServerUrl: undefined, appOrigin: 'smart-terminal://bundle/' };
const sender: SenderInfo = { senderId: 7, isMainFrame: true, frameUrl: 'smart-terminal://bundle/index.html' };

describe('ipc dispatch', () => {
  it('answers valid ping and runtime-info', async () => {
    await expect(dispatchIpc(channels[IPC_CHANNELS.appPing], sender, policy, [])).resolves.toEqual({
      appVersion: '1.2.3',
      platform: 'linux',
    });
    await expect(dispatchIpc(channels[IPC_CHANNELS.appRuntimeInfo], sender, policy, [])).resolves.toEqual(env);
  });

  it.each([[{ a: 1 }], ['x'], [null], [undefined], [1, 2]])('rejects payload %j', async (...args) => {
    await expect(dispatchIpc(channels[IPC_CHANNELS.appPing], sender, policy, args)).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(dispatchIpc(channels[IPC_CHANNELS.appRuntimeInfo], sender, policy, args)).rejects.toThrow(
      'IPC_INVALID_PAYLOAD',
    );
  });

  it('rejects oversize payload', async () => {
    await expect(
      dispatchIpc(channels[IPC_CHANNELS.appPing], sender, policy, ['a'.repeat(MAX_PAYLOAD_BYTES)]),
    ).rejects.toThrow('IPC_PAYLOAD_TOO_LARGE');
  });

  it('rejects non-serializable payload', async () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    await expect(dispatchIpc(channels[IPC_CHANNELS.appPing], sender, policy, [circular])).rejects.toThrow(
      'IPC_INVALID_PAYLOAD',
    );
  });

  it('masks handler errors without leaking details', async () => {
    const failing = {
      validate: (a: unknown[]): a is [] => a.length === 0,
      handle: () => {
        throw new Error('secret /home/user/path');
      },
    };
    await expect(dispatchIpc(failing, sender, policy, [])).rejects.toThrow(/^IPC_INTERNAL$/);
  });

  it('rejects wrong sender, subframe and foreign url', async () => {
    const def = channels[IPC_CHANNELS.appPing];
    await expect(dispatchIpc(def, { ...sender, senderId: 8 }, policy, [])).rejects.toThrow('IPC_INVALID_SENDER');
    await expect(dispatchIpc(def, { ...sender, isMainFrame: false }, policy, [])).rejects.toThrow('IPC_INVALID_SENDER');
    await expect(dispatchIpc(def, { ...sender, frameUrl: 'https://evil.example/' }, policy, [])).rejects.toThrow(
      'IPC_INVALID_SENDER',
    );
  });
});

describe('sender policy', () => {
  it('uses dev server origin when configured', () => {
    const dev = { ...policy, expectedSenderIds: new Set([7]), devServerUrl: 'http://127.0.0.1:4200' };
    expect(isSenderAllowed({ ...sender, frameUrl: 'http://127.0.0.1:4200/x' }, dev)).toBe(true);
    expect(isSenderAllowed({ ...sender, frameUrl: 'http://127.0.0.1:4200.evil.com/' }, dev)).toBe(false);
    expect(isSenderAllowed(sender, dev)).toBe(false);
  });
});

describe('channel whitelist', () => {
  it('knows only approved channels', () => {
    expect(isApprovedChannel(channels, 'app:ping')).toBe(true);
    expect(isApprovedChannel(channels, 'app:runtime-info')).toBe(true);
    expect(isApprovedChannel(channels, 'app:exec')).toBe(false);
    expect(isApprovedChannel(channels, 'toString')).toBe(false);
  });
});

describe('terminal channels', () => {
  const create = channels[IPC_CHANNELS.terminalCreate];
  const write = channels[IPC_CHANNELS.terminalWrite];
  const resize = channels[IPC_CHANNELS.terminalResize];
  const close = channels[IPC_CHANNELS.terminalClose];

  it('dispatches valid requests with the sender id', async () => {
    await expect(dispatchIpc(create, sender, policy, [{ kind: 'local', cwd: '/tmp' }])).resolves.toMatchObject({
      sessionId: 's1',
    });
    expect(gateway.create).toHaveBeenCalledWith(7, { kind: 'local', cwd: '/tmp' });
    await dispatchIpc(write, sender, policy, [{ sessionId: 's1', data: 'ls\n' }]);
    expect(gateway.write).toHaveBeenCalledWith(7, 's1', 'ls\n');
    await dispatchIpc(resize, sender, policy, [{ sessionId: 's1', cols: 100, rows: 30 }]);
    expect(gateway.resize).toHaveBeenCalledWith(7, 's1', 100, 30);
    await dispatchIpc(close, sender, policy, [{ sessionId: 's1' }]);
    expect(gateway.close).toHaveBeenCalledWith(7, 's1');
    await expect(dispatchIpc(channels[IPC_CHANNELS.terminalList], sender, policy, [])).resolves.toEqual([]);
  });

  it.each([
    [create, [{ kind: 'ssh' }]],
    [create, [{ kind: 'local', command: 'rm -rf /' }]],
    [create, [{ kind: 'local', cols: 0 }]],
    [create, [{ kind: 'local', cwd: 5 }]],
    [create, [{}]],
    [create, ['local']],
    [write, [{ sessionId: 's1' }]],
    [write, [{ sessionId: 's1', data: 1 }]],
    [write, [{ sessionId: '', data: 'x' }]],
    [write, [{ sessionId: 's1', data: 'x', extra: true }]],
    [write, [{ sessionId: 's1', data: 'x' }, 1]],
    [resize, [{ sessionId: 's1', cols: 1001, rows: 10 }]],
    [resize, [{ sessionId: 's1', cols: 10.5, rows: 10 }]],
    [resize, [{ sessionId: 's1', cols: '10', rows: 10 }]],
    [close, [{ sessionId: 's1', force: true }]],
    [close, [[]]],
  ] as const)('rejects invalid payload %#', async (definition, args) => {
    await expect(dispatchIpc(definition, sender, policy, [...args])).rejects.toThrow('IPC_INVALID_PAYLOAD');
  });

  it('rejects write data above 64 KiB', async () => {
    await expect(
      dispatchIpc(write, sender, policy, [{ sessionId: 's1', data: 'a'.repeat(64 * 1024 + 1) }]),
    ).rejects.toThrow('IPC_INVALID_PAYLOAD');
  });
});
