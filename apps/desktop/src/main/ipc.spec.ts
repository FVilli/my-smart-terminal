import { describe, expect, it, vi } from 'vitest';
import { AI_ACTION_MAX_PROMPT_BYTES, IPC_CHANNELS, STT_MAX_AUDIO_BYTES } from '@smart-terminal/contracts';
import { TerminalError } from '@smart-terminal/terminal';
import {
  MAX_PAYLOAD_BYTES,
  createChannelMap,
  dispatchIpc,
  isApprovedChannel,
  isSenderAllowed,
  type IpcServices,
  type SenderInfo,
  type SenderPolicy,
  type TerminalGateway,
} from './ipc';

const env = { appVersion: '1.2.3', platform: 'linux', isPackaged: false, isPrimary: () => true };
const gateway = {
  create: vi.fn((_id, request) =>
    Promise.resolve({
      sessionId: 'S1',
      label: 'S1',
      kind: request.kind,
      target: request.kind === 'ssh' ? request.sshAlias : 'local',
      pid: 1,
      cwd: '/tmp',
      machine: 'host',
      sessionDirectory: 'sessions/host/2026-01-01_00.00_S1_local',
      startedAt: '2026-01-01T00:00:00+00:00',
    }),
  ),
  write: vi.fn(),
  resize: vi.fn(),
  close: vi.fn(),
  list: vi.fn(() => []),
  detectEnvironment: vi.fn(async () => ({ os: 'linux' as const, shell: 'bash' as const, source: 'local' as const, detectedAt: '2026-01-01T00:00:00.000Z' })),
};
const services: IpcServices = {
  search: { query: vi.fn(() => ({ entries: [] })), facets: vi.fn(() => ({ machines: ['host'] })), remove: vi.fn(() => ({ removed: true })) }, history: { record: vi.fn(() => ({ recorded: true })) },
  clipboard: {
    state: vi.fn(() => Promise.resolve({ enabled: false, paused: false, lastEventAt: null })),
    configure: vi.fn(() => Promise.resolve({ enabled: true, paused: false, lastEventAt: null })),
    setActive: vi.fn(() => Promise.resolve({ enabled: true, paused: false, lastEventAt: null })),
    clear: vi.fn(() => Promise.resolve({ enabled: true, paused: false, lastEventAt: null })),
  },
  sync: { status: vi.fn(() => Promise.resolve({ state: 'synced' as const, remoteConfigured: false })) },
  clipboardWriter: { writeText: vi.fn() },
  ssh: { aliases: vi.fn(() => ['prod', 'staging']) },
  onboarding: {
    state: vi.fn(() => ({ required: false, reason: 'valid' as const, config: { machineName: 'host', dataRepoPath: '/data', aiProvider: 'none' as const, sttProvider: 'none' as const }, secureStorage: true, storedSecrets: [] })),
    validate: vi.fn(() => ({ ok: true, errors: {} })),
    save: vi.fn(() => ({ ok: true, errors: {}, restartRequired: false, warnings: [] })),
    skip: vi.fn(() => ({ ok: true, errors: {}, restartRequired: false, warnings: [] })),
    testRemote: vi.fn(() => Promise.resolve({ ok: true, committed: true, pushed: true, localOnly: false, state: 'synced' as const })),
    secretsStatus: vi.fn(() => ({ secureStorage: true, storedSecrets: [] })),
    logout: vi.fn(() => ({ secureStorage: true, storedSecrets: [] })),
  },
  app: { relaunch: vi.fn() },
  window: { control: vi.fn() },
  help: { open: vi.fn(() => Promise.resolve()) },
  ai: {
    status: vi.fn(() => ({ configured: true, provider: 'openai' as const, hasToken: true, secureStorage: true })),
    correct: vi.fn(() => ({ original: 'a', corrected: 'a', changed: false, skipped: true, reason: 'shell' as const })),
    testConnection: vi.fn(() => Promise.resolve({ ok: true, provider: 'openai' as const, latencyMs: 0, response: 'OK' })),
    compose: vi.fn(() => ({ prompt: 'composed' })),
    action: vi.fn(() => ({ text: 'answer', skipped: false, elapsedMs: 1 })),
  },
  aiActions: {
    list: vi.fn(() => ({ actions: [], placeholders: [] })),
    save: vi.fn(() => ({ actions: [], placeholders: [] })),
    reset: vi.fn(() => ({ actions: [], placeholders: [] })),
    delete: vi.fn(() => ({ actions: [], placeholders: [] })),
  },
  stt: {
    status: vi.fn(() => ({ configured: true, provider: 'local' as const, hasToken: false, secureStorage: true })),
    models: vi.fn(() => []),
    transcribe: vi.fn(() => ({ text: 'test transcript', skipped: false })),
    saveDebugAudio: vi.fn(() => ({ path: '/tmp/stt-debug/test.webm', bytes: 32 })),
  },
};
const channels = createChannelMap(env, gateway as TerminalGateway, services);

describe('search:remove validation', () => {
  const run = (...args: unknown[]) => dispatchIpc(channels[IPC_CHANNELS.searchRemove], sender, policy, args);
  const valid = { kind: 'history', sessionDirectory: 'sessions/host/2026-01-01_10.00_S1_local', id: 'e1' };

  it('accepts a valid removal request and delegates to the gateway', async () => {
    await expect(run(valid)).resolves.toEqual({ removed: true });
    expect(services.search.remove).toHaveBeenCalledWith(valid);
  });

  it('rejects unknown fields, bad kinds, unsafe directories and malformed ids', async () => {
    await expect(run({ ...valid, extra: 1 })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(run({ ...valid, kind: 'shell' })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(run({ ...valid, sessionDirectory: '../../etc/passwd' })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(run({ ...valid, sessionDirectory: 'sessions/host/not-a-session' })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(run({ ...valid, id: '../x' })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    expect(services.search.remove).not.toHaveBeenCalled();
  });
});

describe('channel map completeness', () => {
  it('exposes exactly the declared IPC channels, each with a validator and handler', () => {
    expect(Object.keys(channels).sort()).toEqual([...Object.values(IPC_CHANNELS)].sort());
    for (const [name, definition] of Object.entries(channels)) {
      expect(typeof definition.validate, `${name} validate`).toBe('function');
      expect(typeof definition.handle, `${name} handle`).toBe('function');
    }
  });
});

const policy: SenderPolicy = { expectedSenderIds: new Set([7]), devServerUrl: undefined, appOrigin: 'smart-terminal://bundle/' };
const sender: SenderInfo = { senderId: 7, isMainFrame: true, frameUrl: 'smart-terminal://bundle/index.html' };

describe('search:query validation', () => {
  const run = (...args: unknown[]) => dispatchIpc(channels[IPC_CHANNELS.searchQuery], sender, policy, args);

  it('accepts a valid query and returns entries', async () => {
    await expect(run({ query: 'ls', machine: 'host', sessionId: 'S1', from: '2026-01-01T00:00:00+00:00', kind: 'history' })).resolves.toEqual({ entries: [] });
    await expect(run({ query: '' })).resolves.toEqual({ entries: [] });
  });

  it.each([
    [{}],
    [{ query: 1 }],
    [{ query: 'a'.repeat(257) }],
    [{ query: 'a', machine: '../x' }],
    [{ query: 'a', from: 'yesterday' }],
    [{ query: 'a', kind: 'shell' }],
    [{ query: 'a', limit: 5 }],
  ])('rejects %j', async (payload) => {
    await expect(run(payload)).rejects.toThrow('IPC_INVALID_PAYLOAD');
  });
});

describe('ipc dispatch', () => {
  it('answers valid ping and runtime-info', async () => {
    await expect(dispatchIpc(channels[IPC_CHANNELS.appPing], sender, policy, [])).resolves.toEqual({
      appVersion: '1.2.3',
      platform: 'linux',
    });
    await expect(dispatchIpc(channels[IPC_CHANNELS.appRuntimeInfo], sender, policy, [])).resolves.toEqual({ appVersion: '1.2.3', platform: 'linux', isPackaged: false, isPrimary: true });
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

  it('maps async allocation failures to a sanitized error code', async () => {
    gateway.create.mockRejectedValueOnce(new TerminalError('TERMINAL_SESSION_ALLOCATION_FAILED'));
    await expect(dispatchIpc(create, sender, policy, [{ kind: 'local' }])).rejects.toThrow('TERMINAL_SESSION_ALLOCATION_FAILED');
    gateway.create.mockRejectedValueOnce(new Error('/secret/path EACCES'));
    await expect(dispatchIpc(create, sender, policy, [{ kind: 'local' }])).rejects.toThrow('IPC_INTERNAL');
  });

  it('dispatches valid requests with the sender id', async () => {
    await expect(dispatchIpc(create, sender, policy, [{ kind: 'local', cwd: '/tmp' }])).resolves.toMatchObject({
      sessionId: 'S1',
      label: 'S1',
      machine: 'host',
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

describe('window controls', () => {
  const run = (...args: unknown[]) => dispatchIpc(channels[IPC_CHANNELS.windowControl], sender, policy, args);

  it('accepts only the three supported actions', async () => {
    await run({ action: 'minimize' });
    await run({ action: 'toggle-maximize' });
    await run({ action: 'close' });
    expect(services.window.control).toHaveBeenNthCalledWith(1, 7, 'minimize');
    expect(services.window.control).toHaveBeenNthCalledWith(2, 7, 'toggle-maximize');
    expect(services.window.control).toHaveBeenNthCalledWith(3, 7, 'close');
    for (const payload of [{}, { action: 'maximize' }, { action: 'close', extra: true }, { action: 1 }]) {
      await expect(run(payload)).rejects.toThrow('IPC_INVALID_PAYLOAD');
    }
  });
});

describe('M04-T04 channels', () => {
  const run = (channel: (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS], ...args: unknown[]) =>
    dispatchIpc(channels[channel as keyof typeof channels]!, sender, policy, args);

  it('answers search:facets and sync:get-status without arguments', async () => {
    await expect(run(IPC_CHANNELS.searchFacets)).resolves.toEqual({ machines: ['host'] });
    await expect(run(IPC_CHANNELS.syncStatus)).resolves.toEqual({ state: 'synced', remoteConfigured: false });
    await expect(run(IPC_CHANNELS.searchFacets, {})).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(run(IPC_CHANNELS.syncStatus, 1)).rejects.toThrow('IPC_INVALID_PAYLOAD');
  });

  it('validates clipboard:write and writes through the writer', async () => {
    await run(IPC_CHANNELS.clipboardWrite, { text: 'ciao' });
    expect(services.clipboardWriter.writeText).toHaveBeenCalledWith('ciao');
    for (const payload of [{}, { text: '' }, { text: 1 }, { text: 'x', extra: 1 }, { text: 'a'.repeat(32 * 1024 + 1) }]) {
      await expect(run(IPC_CHANNELS.clipboardWrite, payload)).rejects.toThrow('IPC_INVALID_PAYLOAD');
    }
  });
});

describe('M05 channels', () => {
  const run = (channel: (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS], ...args: unknown[]) =>
    dispatchIpc(channels[channel as keyof typeof channels]!, sender, policy, args);

  it('accepts ssh create requests only with a safe alias and no cwd', async () => {
    await expect(run(IPC_CHANNELS.terminalCreate, { kind: 'ssh', sshAlias: 'prod-1.example', cols: 80, rows: 24 })).resolves.toMatchObject({ kind: 'ssh', target: 'prod-1.example' });
    for (const bad of [
      { kind: 'ssh', sshAlias: '-oProxyCommand=x' },
      { kind: 'ssh', sshAlias: 'a b' },
      { kind: 'ssh', sshAlias: 'a;b' },
      { kind: 'ssh', sshAlias: 'prod', cwd: '/tmp' },
      { kind: 'local', sshAlias: 'prod' },
      { kind: 'ssh', sshAlias: 5 },
    ]) {
      await expect(run(IPC_CHANNELS.terminalCreate, bad)).rejects.toThrow('IPC_INVALID_PAYLOAD');
    }
  });

  it('lists ssh aliases and validates onboarding payloads', async () => {
    await expect(run(IPC_CHANNELS.sshAliases)).resolves.toEqual(['prod', 'staging']);
    await expect(run(IPC_CHANNELS.sshAliases, 1)).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(run(IPC_CHANNELS.onboardingState)).resolves.toMatchObject({ required: false });
    await expect(run(IPC_CHANNELS.onboardingSave, { config: { machineName: 'a' }, aiToken: 't' })).resolves.toMatchObject({ ok: true });
    await expect(run(IPC_CHANNELS.onboardingSave, { config: {}, extra: 1 })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(run(IPC_CHANNELS.onboardingSave, { config: {}, aiToken: 1 })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(run(IPC_CHANNELS.onboardingValidate, { config: 'x' })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(run(IPC_CHANNELS.onboardingSkip)).resolves.toMatchObject({ ok: true });
    await expect(run(IPC_CHANNELS.secretsLogout, { key: 'ai:openai' })).resolves.toMatchObject({ secureStorage: true });
    await expect(run(IPC_CHANNELS.secretsLogout, {})).rejects.toThrow('IPC_INVALID_PAYLOAD');
  });

  it('relaunches the app only without arguments', async () => {
    await run(IPC_CHANNELS.appRelaunch);
    expect(services.app.relaunch).toHaveBeenCalledTimes(1);
    await expect(run(IPC_CHANNELS.appRelaunch, 1)).rejects.toThrow('IPC_INVALID_PAYLOAD');
  });
});

describe('stt channels', () => {
  const run = (...args: unknown[]) => dispatchIpc(channels[IPC_CHANNELS.sttTranscribe], sender, policy, args);
  const audio = (size = 64): Uint8Array => new Uint8Array(size).fill(3);

  it('answers stt:status without arguments', async () => {
    await expect(dispatchIpc(channels[IPC_CHANNELS.sttStatus], sender, policy, [])).resolves.toMatchObject({
      configured: true,
      provider: 'local',
    });
    await expect(dispatchIpc(channels[IPC_CHANNELS.sttStatus], sender, policy, [1])).rejects.toThrow('IPC_INVALID_PAYLOAD');
  });

  it('dispatches a valid transcribe request to the gateway', async () => {
    await expect(run({ audio: audio(16), mimeType: 'audio/webm' })).resolves.toMatchObject({ text: 'test transcript' });
    const [request] = (services.stt.transcribe as unknown as { mock: { calls: [{ audio: Uint8Array }][] } }).mock.calls.at(-1) ?? [];
    expect(request?.audio.byteLength).toBe(16);
  });

  it('accepts up to 10 MiB of audio (structured clone, not JSON expansion)', async () => {
    await expect(run({ audio: audio(STT_MAX_AUDIO_BYTES), mimeType: 'audio/webm' })).resolves.toMatchObject({ skipped: false });
    await expect(run({ audio: audio(STT_MAX_AUDIO_BYTES + 1), mimeType: 'audio/webm' })).rejects.toThrow('IPC_INVALID_PAYLOAD');
  });

  it.each([
    [{ audio: 'audio', mimeType: 'audio/webm' }],
    [{ audio: new Uint8Array(0), mimeType: 'audio/webm' }],
    [{ audio: audio(), mimeType: 'text/plain' }],
    [{ audio: audio(), mimeType: 'audio/webm;codecs=opus' }],
    [{ audio: audio() }],
    [{ audio: audio(), mimeType: 'audio/webm', extra: 1 }],
    [{ audio: audio(), mimeType: 'audio/webm', language: 'it' }],
    [{ mimeType: 'audio/webm' }],
  ])('rejects invalid transcribe payload %#', async (payload) => {
    await expect(run(payload)).rejects.toThrow('IPC_INVALID_PAYLOAD');
  });

  it('keeps the default payload limit for other channels', async () => {
    await expect(
      dispatchIpc(channels[IPC_CHANNELS.aiCorrect], sender, policy, [{ text: 'a'.repeat(MAX_PAYLOAD_BYTES) }]),
    ).rejects.toThrow('IPC_PAYLOAD_TOO_LARGE');
  });
});

describe('ai:compose and ai:action validation', () => {
  const compose = (...args: unknown[]) => dispatchIpc(channels[IPC_CHANNELS.aiCompose], sender, policy, args);
  const action = (...args: unknown[]) => dispatchIpc(channels[IPC_CHANNELS.aiAction], sender, policy, args);
  const environment = { os: 'linux', shell: 'bash', source: 'local' };

  it('accepts valid compose/action payloads and delegates', async () => {
    await expect(compose({ action: 'suggest-command', input: 'list files', environment })).resolves.toEqual({ prompt: 'composed' });
    await expect(action({ action: 'suggest-command', prompt: '<user_body>\nlist files\n</user_body>' })).resolves.toMatchObject({ text: 'answer' });
    expect(services.ai.compose).toHaveBeenCalledWith({ action: 'suggest-command', input: 'list files', environment });
    expect(services.ai.action).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown actions, malformed environments and extra keys', async () => {
    await expect(compose({ action: 'run-command', input: 'x' })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(compose({ action: 'fix-message', input: 'x', environment: { os: 'sunos', shell: 'bash' } })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(compose({ action: 'fix-message', input: 'x', environment: { os: 'linux', shell: 'bash', extra: 1 } })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(compose({ action: 'fix-message', input: 'x', extra: true })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(action({ action: 'fix-message', prompt: '   ' })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(action({ action: 'fix-message', prompt: 'x', extra: 1 })).rejects.toThrow('IPC_INVALID_PAYLOAD');
  });

  it('rejects prompts over the action size limit', async () => {
    await expect(action({ action: 'fix-message', prompt: 'a'.repeat(AI_ACTION_MAX_PROMPT_BYTES + 1) })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    await expect(compose({ action: 'fix-message', input: 'a'.repeat(AI_ACTION_MAX_PROMPT_BYTES + 1) })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    expect(services.ai.action).not.toHaveBeenCalled();
    expect(services.ai.compose).not.toHaveBeenCalled();
  });

describe('terminal:detect-environment validation', () => {
  const run = (...args: unknown[]) => dispatchIpc(channels[IPC_CHANNELS.terminalDetectEnvironment], sender, policy, args);
  it('accepts a session id and delegates to the terminal gateway', async () => {
    await expect(run({ sessionId: 'S1' })).resolves.toMatchObject({ os: 'linux' });
    expect(gateway.detectEnvironment).toHaveBeenCalledWith(7, 'S1');
  });
  it('rejects missing, empty, oversized or extra fields', async () => {
    for (const payload of [{}, { sessionId: '' }, { sessionId: 'x'.repeat(65) }, { sessionId: 'S1', extra: 1 }, { sessionId: 1 }]) {
      await expect(run(payload)).rejects.toThrow('IPC_INVALID_PAYLOAD');
    }
  });
});
});

describe('ai:actions validation', () => {
  const run = (channel: string, ...args: unknown[]) => dispatchIpc(channels[channel as keyof typeof channels]!, sender, policy, args);
  const action = { id: 'custom-review', title: 'Review diff', description: 'Review a diff', systemTemplate: 'System {{os}}', userTemplate: 'User {{composer}}' };

  it('accepts valid save/reset/delete payloads and delegates', async () => {
    await expect(run(IPC_CHANNELS.aiActionsSave, { action })).resolves.toMatchObject({ actions: [] });
    await expect(run(IPC_CHANNELS.aiActionsReset, { id: 'fix-message' })).resolves.toMatchObject({ actions: [] });
    await expect(run(IPC_CHANNELS.aiActionsDelete, { id: 'custom-review' })).resolves.toMatchObject({ actions: [] });
    expect(services.aiActions.save).toHaveBeenCalledWith({ action });
  });

  it('rejects malformed actions and ids', async () => {
    for (const payload of [
      {},
      { action: { ...action, extra: 1 } },
      { action: { ...action, title: '' } },
      { action: { ...action, title: 'x'.repeat(61) } },
      { action: { ...action, description: 'a\nb' } },
      { action: { ...action, systemTemplate: 'x'.repeat(8 * 1024 + 1) } },
      { action: { ...action, systemTemplate: 1 } },
    ]) {
      await expect(run(IPC_CHANNELS.aiActionsSave, payload)).rejects.toThrow('IPC_INVALID_PAYLOAD');
    }
    for (const id of ['', 1, 'x'.repeat(65)]) {
      await expect(run(IPC_CHANNELS.aiActionsReset, { id })).rejects.toThrow('IPC_INVALID_PAYLOAD');
      await expect(run(IPC_CHANNELS.aiActionsDelete, { id })).rejects.toThrow('IPC_INVALID_PAYLOAD');
    }
  });
});
