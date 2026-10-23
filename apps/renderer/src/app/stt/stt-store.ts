import { Injectable, signal } from '@angular/core';
import type { SmartTerminalApi, SttStatus, SttTranscribeResult } from '@smart-terminal/contracts';

/**
 * Locally typed microphone DOM subsets: renderer tests run without the DOM library
 * and replace `navigator.mediaDevices`/`MediaRecorder` on `globalThis`.
 */
export interface AudioTrackLike {
  stop(): void;
}

export interface MediaStreamLike {
  getTracks(): AudioTrackLike[];
}

export interface AudioChunkLike {
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface MediaRecorderLike {
  /** For example, `audio/webm;codecs=opus`: parameters are removed before sending. */
  readonly mimeType: string;
  ondataavailable: ((event: { data: AudioChunkLike }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}

interface MediaDevicesScope {
  navigator?: { mediaDevices?: { getUserMedia(constraints: { audio: boolean }): Promise<MediaStreamLike> } };
  MediaRecorder?: new (stream: MediaStreamLike, options?: { mimeType?: string }) => MediaRecorderLike;
}

export type SttPhase = 'idle' | 'recording' | 'transcribing';
export type SttVoiceError = 'denied' | 'unavailable' | 'unconfigured';

/** Safety limit: recording stops automatically after 60 seconds. */
export const MAX_RECORDING_MS = 60_000;
/** `MediaRecorder` emits a chunk every 250 ms, so even a brief push-to-talk produces audio. */
export const RECORDER_TIMESLICE_MS = 250;
export const FALLBACK_AUDIO_MIME = 'audio/webm';

const VOICE_LABELS = {
  idle: 'Voice ready',
  recording: 'Listening…',
  transcribing: 'Transcribing…',
  denied: 'Microphone denied',
  unavailable: 'Microphone unavailable',
  unconfigured: 'STT not configured',
} as const;

export const UNCONFIGURED_STATUS: SttStatus = {
  configured: false,
  provider: 'none',
  hasToken: false,
  secureStorage: false,
};

/** Label below the microphone: explicit error, then flow state, then STT availability. */
export function voiceLabel(status: SttStatus, phase: SttPhase, error: SttVoiceError | null): string {
  if (error === 'denied') {
    return VOICE_LABELS.denied;
  }
  if (error === 'unavailable') {
    return VOICE_LABELS.unavailable;
  }
  if (!status.configured) {
    return VOICE_LABELS.unconfigured;
  }
  if (error === 'unconfigured') {
    return VOICE_LABELS.unconfigured;
  }
  return phase === 'recording' ? VOICE_LABELS.recording : phase === 'transcribing' ? VOICE_LABELS.transcribing : VOICE_LABELS.idle;
}

/** `audio/webm;codecs=opus` -> `audio/webm`: the main process accepts only MIME types without parameters. */
export function normalizeAudioMime(mimeType: string | undefined): string {
  const base = (mimeType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return base.startsWith('audio/') ? base : FALLBACK_AUDIO_MIME;
}

/** Dictated text is appended to the draft: there is no automatic send, and it remains editable. */
export function appendTranscript(draft: string, transcript: string): string {
  const text = transcript.trim();
  if (text.length === 0) {
    return draft;
  }
  return draft.trim().length === 0 ? text : `${draft.trimEnd()} ${text}`;
}

export function sttNotice(reason: SttTranscribeResult['reason']): string {
  switch (reason) {
    case 'missing-token':
      return 'STT not configured: cloud token missing.';
    case 'unconfigured':
      return 'STT not configured: no active provider.';
    case 'timeout':
      return 'STT unavailable (timeout): try again.';
    case 'unsupported':
      return 'Unsupported STT provider.';
    case 'invalid-audio':
      return 'Invalid audio: recording ignored.';
    case 'empty':
      return 'No speech recognized.';
    default:
      return 'STT unavailable: try again.';
  }
}

/**
 * Push-to-talk microphone for assisted input.
 * Audio exists only in memory between `MediaRecorder` and `sttTranscribe`: no persistent recording.
 */
@Injectable({ providedIn: 'root' })
export class SttStore {
  private readonly api: SmartTerminalApi = (globalThis as unknown as { smartTerminal: SmartTerminalApi }).smartTerminal;
  private readonly statusState = signal<SttStatus>(UNCONFIGURED_STATUS);
  private readonly phaseState = signal<SttPhase>('idle');
  private readonly errorState = signal<SttVoiceError | null>(null);
  private readonly noticeState = signal<string | null>(null);
  private readonly transcriptListeners = new Set<(text: string) => void>();

  private stream: MediaStreamLike | null = null;
  private recorder: MediaRecorderLike | null = null;
  private chunks: AudioChunkLike[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private startPromise: Promise<void> | null = null;
  private stopping = false;
  private discard = false;
  private stopped: (() => void) | null = null;

  readonly status = this.statusState.asReadonly();
  readonly phase = this.phaseState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly notice = this.noticeState.asReadonly();

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.statusState.set(await this.api.sttStatus());
    } catch {
      this.statusState.set(UNCONFIGURED_STATUS);
    }
  }

  /** Dictated text arrives here (including when recording stops automatically after 60 seconds). */
  onTranscript(listener: (text: string) => void): () => void {
    this.transcriptListeners.add(listener);
    return () => this.transcriptListeners.delete(listener);
  }

  canRecord(): boolean {
    return this.phaseState() === 'idle' && this.statusState().configured;
  }

  /** Starts recording (pointerdown or keyboard toggle). */
  start(): Promise<void> {
    if (this.startPromise !== null) {
      return this.startPromise;
    }
    if (this.phaseState() !== 'idle') {
      return Promise.resolve();
    }
    if (!this.statusState().configured) {
      this.errorState.set('unconfigured');
      this.noticeState.set(sttNotice('unconfigured'));
      return Promise.resolve();
    }
    this.errorState.set(null);
    this.noticeState.set(null);
    this.discard = false;
    this.stopping = false;
    this.startPromise = this.acquire().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  private async acquire(): Promise<void> {
    const scope = globalThis as unknown as MediaDevicesScope;
    let stream: MediaStreamLike;
    try {
      const devices = scope.navigator?.mediaDevices;
      if (devices === undefined) {
        throw new Error('unavailable');
      }
      stream = await devices.getUserMedia({ audio: true });
    } catch (error) {
      const name = (error as { name?: unknown }).name;
      const denied = typeof name === 'string' && ['NotAllowedError', 'SecurityError'].includes(name);
      this.errorState.set(denied ? 'denied' : 'unavailable');
      return;
    }
    const recorder = this.createRecorder(stream);
    if (recorder === null) {
      stopTracks(stream);
      this.errorState.set('unavailable');
      return;
    }
    if (this.discard) {
      // `halt()` arrived while permission was pending: nothing is recorded.
      this.discard = false;
      stopTracks(stream);
      return;
    }
    this.stream = stream;
    this.recorder = recorder;
    this.chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data !== undefined && event.data !== null) {
        this.chunks.push(event.data);
      }
    };
    recorder.onstop = () => void this.finish();
    recorder.onerror = () => this.failRecording('unavailable');
    try {
      recorder.start(RECORDER_TIMESLICE_MS);
    } catch {
      stopTracks(stream);
      this.stream = null;
      this.recorder = null;
      this.errorState.set('unavailable');
      return;
    }
    this.phaseState.set('recording');
    this.timer = setTimeout(() => void this.stop(), MAX_RECORDING_MS);
  }

  /** Stops recording and transcribes. Resolves when the text has been emitted (or discarded). */
  async stop(): Promise<void> {
    const starting = this.startPromise;
    if (starting !== null) {
      await starting;
    }
    const recorder = this.recorder;
    if (recorder === null || this.stopping || this.phaseState() !== 'recording') {
      return;
    }
    this.stopping = true;
    this.clearTimer();
    const done = new Promise<void>((resolve) => {
      this.stopped = resolve;
    });
    try {
      recorder.stop();
    } catch {
      this.failRecording('unavailable');
      return;
    }
    return done;
  }

  /** Stops without transcribing (tab change, destroy, cancellation). */
  halt(): void {
    this.discard = true;
    if (this.recorder !== null) {
      void this.stop();
      return;
    }
    stopTracks(this.stream);
    this.stream = null;
    this.clearTimer();
    this.phaseState.set('idle');
  }

  private createRecorder(stream: MediaStreamLike): MediaRecorderLike | null {
    const ctor = (globalThis as unknown as MediaDevicesScope).MediaRecorder;
    if (ctor === undefined) {
      return null;
    }
    try {
      return new ctor(stream);
    } catch {
      return null;
    }
  }

  private async finish(): Promise<void> {
    const recorder = this.recorder;
    if (recorder === null) {
      // onstop arrived after an already handled error: nothing to transcribe.
      const stray = this.stopped;
      this.stopped = null;
      stray?.();
      return;
    }
    const stream = this.stream;
    const chunks = this.chunks;
    const discarded = this.discard;
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
    this.discard = false;
    this.stopping = false;
    this.clearTimer();
    stopTracks(stream);
    try {
      if (!discarded) {
        await this.transcribe(recorder.mimeType, chunks);
      }
    } finally {
      this.phaseState.set('idle');
      const done = this.stopped;
      this.stopped = null;
      done?.();
    }
  }

  private async transcribe(mimeType: string | undefined, chunks: AudioChunkLike[]): Promise<void> {
    const audio = await this.toBytes(chunks);
    if (audio === null) {
      this.errorState.set('unavailable');
      this.noticeState.set(sttNotice('invalid-audio'));
      return;
    }
    this.phaseState.set('transcribing');
    let result: SttTranscribeResult;
    try {
      result = await this.api.sttTranscribe({ audio, mimeType: normalizeAudioMime(mimeType) });
    } catch {
      this.noticeState.set(sttNotice('provider-error'));
      return;
    }
    if (result.skipped) {
      this.noticeState.set(sttNotice(result.reason));
      return;
    }
    this.errorState.set(null);
    this.noticeState.set(null);
    for (const listener of this.transcriptListeners) {
      listener(result.text);
    }
  }

  private async toBytes(chunks: AudioChunkLike[]): Promise<Uint8Array | null> {
    const parts = await Promise.all(chunks.map((chunk) => chunk.arrayBuffer()));
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
    if (total === 0) {
      return null;
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      bytes.set(new Uint8Array(part), offset);
      offset += part.byteLength;
    }
    return bytes;
  }

  private failRecording(error: SttVoiceError): void {
    this.recorder = null;
    stopTracks(this.stream);
    this.stream = null;
    this.chunks = [];
    this.stopping = false;
    this.clearTimer();
    this.errorState.set(error);
    this.phaseState.set('idle');
    const done = this.stopped;
    this.stopped = null;
    done?.();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

function stopTracks(stream: MediaStreamLike | null): void {
  for (const track of stream?.getTracks() ?? []) {
    try {
      track.stop();
    } catch {
      // the track was already closed
    }
  }
}
