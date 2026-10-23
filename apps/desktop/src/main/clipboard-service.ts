import type { ClipboardCaptureState, ClipboardConfigureRequest, ClipboardSetActiveRequest } from '@smart-terminal/contracts';
import {
  ClipboardRecorder,
  resolveSessionDirectory,
  sessionFilePaths,
  type ClipboardTextSource,
} from '@smart-terminal/data';

export interface ClipboardServiceOptions {
  dataRepoPath: string;
  source: ClipboardTextSource;
  /** Risolve una sessione viva della finestra `senderId`. */
  resolveSession(senderId: number, sessionId: string): { sessionDirectory: string } | undefined;
  /** Stato iniziale (opt-in da env). */
  initiallyEnabled?: boolean;
  onRecorded?(sessionDirectory: string): void;
}

/** Collega il ClipboardRecorder alle sessioni del main: una sola istanza (e quindi un solo timer) per processo. */
export class ClipboardService {
  private readonly recorder: ClipboardRecorder;
  private active: { senderId: number; sessionId: string } | null = null;

  constructor(private readonly options: ClipboardServiceOptions) {
    this.recorder = new ClipboardRecorder({
      source: options.source,
      resolveTarget: (sessionId) => {
        if (this.active === null || this.active.sessionId !== sessionId) {
          return undefined;
        }
        const session = options.resolveSession(this.active.senderId, sessionId);
        if (session === undefined) {
          return undefined;
        }
        return {
          sessionDirectory: session.sessionDirectory,
          clipboardFile: sessionFilePaths(resolveSessionDirectory(options.dataRepoPath, session.sessionDirectory)).clipboardFile,
        };
      },
      ...(options.onRecorded !== undefined ? { onRecorded: (_sessionId, target) => options.onRecorded?.(target.sessionDirectory) } : {}),
    });
    if (options.initiallyEnabled === true) {
      this.recorder.configure({ enabled: true, paused: false });
    }
  }

  state(): ClipboardCaptureState {
    const { enabled, paused, lastEventAt } = this.recorder.state();
    return { enabled, paused, lastEventAt };
  }

  configure(request: ClipboardConfigureRequest): ClipboardCaptureState {
    this.recorder.configure(request);
    return this.state();
  }

  setActive(senderId: number, request: ClipboardSetActiveRequest): ClipboardCaptureState {
    if (request.sessionId !== null && this.options.resolveSession(senderId, request.sessionId) !== undefined) {
      this.active = { senderId, sessionId: request.sessionId };
      this.recorder.setActiveSession(request.sessionId);
    } else if (request.sessionId === null && this.active?.senderId === senderId) {
      this.active = null;
      this.recorder.setActiveSession(null);
    }
    return this.state();
  }

  clear(): ClipboardCaptureState {
    this.recorder.clearDedupe();
    return this.state();
  }

  dispose(): void {
    this.recorder.dispose();
  }
}
