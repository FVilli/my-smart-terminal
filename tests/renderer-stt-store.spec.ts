// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SttStatus, SttTranscribeResult } from '@smart-terminal/contracts';
import {
  MAX_RECORDING_MS,
  SttStore,
  appendTranscript,
  normalizeAudioMime,
  voiceLabel,
  type AudioChunkLike,
  type MediaRecorderLike,
  type MediaStreamLike,
} from '../apps/renderer/src/app/stt/stt-store';

const configured: SttStatus = { configured: true, provider: 'local', hasToken: false, secureStorage: true };

const chunk = (size: number): AudioChunkLike => ({
  size,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(size)),
});

class FakeRecorder implements MediaRecorderLike {
  readonly mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((event: { data: AudioChunkLike }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  started = false;
  stopped = false;

  constructor(readonly stream: MediaStreamLike) {
    FakeRecorder.instances.push(this);
  }

  static instances: FakeRecorder[] = [];

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.stopped = true;
    this.ondataavailable?.({ data: chunk(48) });
    this.onstop?.();
  }
}

function fakeStream(): { stream: MediaStreamLike; stopped: () => boolean } {
  let stopped = false;
  const track = {
    stop: () => {
      stopped = true;
    },
  };
  return { stream: { getTracks: () => [track] }, stopped: () => stopped };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
};

describe('SttStore', () => {
  const getUserMedia = vi.fn();
  const sttStatus = vi.fn<() => Promise<SttStatus>>();
  const sttTranscribe = vi.fn<(request: { audio: Uint8Array; mimeType: string }) => Promise<SttTranscribeResult>>();
  const writeTerminal = vi.fn();
  const recordHistory = vi.fn();

  beforeEach(() => {
    FakeRecorder.instances = [];
    getUserMedia.mockReset();
    sttStatus.mockReset().mockResolvedValue(configured);
    sttTranscribe.mockReset().mockResolvedValue({ text: 'testo dettato di prova', skipped: false });
    writeTerminal.mockReset();
    recordHistory.mockReset();
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.stubGlobal('smartTerminal', { sttStatus, sttTranscribe, writeTerminal, recordHistory });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('loads the status at startup and exposes the idle label', async () => {
    const store = new SttStore();
    await flush();
    expect(sttStatus).toHaveBeenCalledTimes(1);
    expect(store.status()).toMatchObject({ configured: true, provider: 'local' });
    expect(voiceLabel(store.status(), store.phase(), store.error())).toBe('Voice ready');
    expect(store.canRecord()).toBe(true);
  });

  it('does not touch the microphone when the provider is not configured', async () => {
    sttStatus.mockResolvedValue({ configured: false, provider: 'none', hasToken: false, secureStorage: true });
    const store = new SttStore();
    await flush();
    await store.start();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(store.error()).toBe('unconfigured');
    expect(voiceLabel(store.status(), store.phase(), store.error())).toBe('STT non configurato');
    expect(store.notice()).toContain('STT non configurato');
  });

  it('reports a denied permission without blocking anything else', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const store = new SttStore();
    await flush();
    await store.start();
    expect(store.phase()).toBe('idle');
    expect(store.error()).toBe('denied');
    expect(voiceLabel(store.status(), store.phase(), store.error())).toBe('Microfono negato');
    expect(writeTerminal).not.toHaveBeenCalled();
    expect(recordHistory).not.toHaveBeenCalled();
  });

  it('reports an unavailable microphone when the device is missing', async () => {
    getUserMedia.mockRejectedValue(new Error('NotFoundError'));
    const store = new SttStore();
    await flush();
    await store.start();
    expect(store.error()).toBe('unavailable');
    expect(voiceLabel(store.status(), store.phase(), store.error())).toBe('Microfono non disponibile');
  });

  it('records, transcribes the audio and delivers the text without sending it', async () => {
    const { stream, stopped } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const store = new SttStore();
    const received: string[] = [];
    store.onTranscript((text) => received.push(text));
    await flush();

    const starting = store.start();
    await starting;
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(store.phase()).toBe('recording');
    expect(voiceLabel(store.status(), store.phase(), store.error())).toBe('Ascolto…');

    await store.stop();
    expect(FakeRecorder.instances[0]?.stopped).toBe(true);
    expect(stopped()).toBe(true);
    expect(store.phase()).toBe('idle');
    expect(sttTranscribe).toHaveBeenCalledTimes(1);
    const request = sttTranscribe.mock.calls[0]?.[0];
    expect(request?.audio).toBeInstanceOf(Uint8Array);
    expect(request?.audio.byteLength).toBe(48);
    // I parametri del codec vengono rimossi: il main accetta solo `audio/*` senza parametri.
    expect(request?.mimeType).toBe('audio/webm');
    expect(received).toEqual(['testo dettato di prova']);
    // La trascrizione non invia nulla al PTY né in history.
    expect(writeTerminal).not.toHaveBeenCalled();
    expect(recordHistory).not.toHaveBeenCalled();
  });

  it('shows a localized notice when the transcription is skipped', async () => {
    const { stream } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    sttTranscribe.mockResolvedValue({ text: '', skipped: true, reason: 'timeout' });
    const store = new SttStore();
    await flush();
    await store.start();
    await store.stop();
    expect(store.notice()).toContain('timeout');
    expect(store.phase()).toBe('idle');
  });

  it('stops the recorder after 60 seconds and still delivers the text', async () => {
    vi.useFakeTimers();
    const { stream, stopped } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const store = new SttStore();
    const received: string[] = [];
    store.onTranscript((text) => received.push(text));
    await flush();
    await store.start();
    await vi.advanceTimersByTimeAsync(MAX_RECORDING_MS - 1);
    expect(FakeRecorder.instances[0]?.stopped).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeRecorder.instances[0]?.stopped).toBe(true);
    expect(stopped()).toBe(true);
    expect(store.phase()).toBe('idle');
    expect(received).toEqual(['testo dettato di prova']);
  });

  it('halts without transcribing and releases the tracks (tab change or destroy)', async () => {
    const { stream, stopped } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const store = new SttStore();
    await flush();
    await store.start();
    store.halt();
    await flush();
    expect(stopped()).toBe(true);
    expect(sttTranscribe).not.toHaveBeenCalled();
    expect(store.phase()).toBe('idle');
  });

  it('interrupts a start that is still waiting for the permission', async () => {
    let resolveStream: (stream: MediaStreamLike) => void = () => undefined;
    getUserMedia.mockReturnValue(
      new Promise<MediaStreamLike>((resolve) => {
        resolveStream = resolve;
      }),
    );
    const store = new SttStore();
    await flush();
    const starting = store.start();
    store.halt();
    const { stream, stopped } = fakeStream();
    resolveStream(stream);
    await starting;
    await flush();
    expect(stopped()).toBe(true);
    expect(FakeRecorder.instances[0]?.started).toBe(false);
    expect(sttTranscribe).not.toHaveBeenCalled();
    expect(store.phase()).toBe('idle');
  });

  it('treats a missing MediaRecorder implementation as unavailable', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const { stream, stopped } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const store = new SttStore();
    await flush();
    await store.start();
    expect(store.error()).toBe('unavailable');
    expect(stopped()).toBe(true);
    expect(sttTranscribe).not.toHaveBeenCalled();
  });
});

describe('voice helpers', () => {
  it('maps status, phase and errors to the localized label', () => {
    expect(voiceLabel(configured, 'idle', null)).toBe('Voice ready');
    expect(voiceLabel(configured, 'recording', null)).toBe('Ascolto…');
    expect(voiceLabel(configured, 'transcribing', null)).toBe('Trascrivo…');
    expect(voiceLabel(configured, 'idle', 'denied')).toBe('Microfono negato');
    expect(voiceLabel(configured, 'idle', 'unavailable')).toBe('Microfono non disponibile');
    expect(voiceLabel({ ...configured, configured: false }, 'idle', null)).toBe('STT non configurato');
  });

  it('normalizes the recorder mime type and appends the transcript to the draft', () => {
    expect(normalizeAudioMime('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(normalizeAudioMime('AUDIO/OGG')).toBe('audio/ogg');
    expect(normalizeAudioMime(undefined)).toBe('audio/webm');
    expect(normalizeAudioMime('video/webm')).toBe('audio/webm');
    expect(appendTranscript('', ' ciao ')).toBe('ciao');
    expect(appendTranscript('echo', 'ciao mondo')).toBe('echo ciao mondo');
    expect(appendTranscript('echo ', 'ciao')).toBe('echo ciao');
    expect(appendTranscript('echo', '   ')).toBe('echo');
  });
});
