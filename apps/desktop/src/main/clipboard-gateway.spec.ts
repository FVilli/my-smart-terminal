import { describe, expect, it, vi } from 'vitest';
import { ClipboardGatewayAdapter, type ClipboardBackend } from './clipboard-gateway';

const state = { enabled: true, paused: false, lastEventAt: null };

function setup() {
  const backend: ClipboardBackend = {
    clipboardState: vi.fn(() => Promise.resolve(state)),
    clipboardConfigure: vi.fn(() => Promise.resolve(state)),
    clipboardSetActive: vi.fn(() => Promise.resolve(state)),
    clipboardClear: vi.fn(() => Promise.resolve(state)),
  };
  const sessions = new Map([['1:S1', 'sessions/host/2026-01-01_00.00_S1_local']]);
  const adapter = new ClipboardGatewayAdapter(backend, (senderId, sessionId) => {
    const sessionDirectory = sessions.get(`${senderId}:${sessionId}`);
    return sessionDirectory === undefined ? undefined : { sessionDirectory };
  });
  return { backend, adapter };
}

describe('ClipboardGatewayAdapter', () => {
  it('translates a live window session into its directory', async () => {
    const { backend, adapter } = setup();
    await adapter.setActive(1, { sessionId: 'S1' });
    expect(backend.clipboardSetActive).toHaveBeenCalledWith('sessions/host/2026-01-01_00.00_S1_local');
  });

  it('ignores sessions that do not belong to the sender', async () => {
    const { backend, adapter } = setup();
    await adapter.setActive(2, { sessionId: 'S1' });
    expect(backend.clipboardSetActive).not.toHaveBeenCalled();
    expect(backend.clipboardState).toHaveBeenCalled();
  });

  it('lets only the activating window deactivate', async () => {
    const { backend, adapter } = setup();
    await adapter.setActive(1, { sessionId: 'S1' });
    await adapter.setActive(2, { sessionId: null });
    expect(backend.clipboardSetActive).toHaveBeenCalledTimes(1);
    await adapter.setActive(1, { sessionId: null });
    expect(backend.clipboardSetActive).toHaveBeenLastCalledWith(null);
  });

  it('forwards configure and clear', async () => {
    const { backend, adapter } = setup();
    await adapter.configure({ enabled: true, paused: true });
    await adapter.clear();
    expect(backend.clipboardConfigure).toHaveBeenCalledWith({ enabled: true, paused: true });
    expect(backend.clipboardClear).toHaveBeenCalled();
  });
});
