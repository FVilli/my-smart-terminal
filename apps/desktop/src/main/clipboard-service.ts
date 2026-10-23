import type { ClipboardCaptureState, ClipboardConfigureRequest } from '@smart-terminal/contracts';
import {
  ClipboardRecorder,
  resolveSessionDirectory,
  sessionFilePaths,
  type ClipboardTextSource,
} from '@smart-terminal/data';

export interface ClipboardServiceOptions {
  dataRepoPath: string;
  source: ClipboardTextSource;
  onRecorded?(sessionDirectory: string): void;
  /** Test only: intervallo di polling. */
  intervalMs?: number;
}

/**
 * Clipboard capture owned by the primary: one instance (and one timer) per machine.
 * The active session is identified by the relative directory `sessions/<machine>/<dir>`, validated inside the data repository.
 */
export class ClipboardService {
  private readonly recorder: ClipboardRecorder;

  constructor(private readonly options: ClipboardServiceOptions) {
    this.recorder = new ClipboardRecorder({
      source: options.source,
      ...(options.intervalMs !== undefined ? { intervalMs: options.intervalMs } : {}),
      resolveTarget: (sessionDirectory) => {
        try {
          return {
            sessionDirectory,
            clipboardFile: sessionFilePaths(resolveSessionDirectory(options.dataRepoPath, sessionDirectory)).clipboardFile,
          };
        } catch {
          return undefined;
        }
      },
      onRecorded: (_sessionDirectory, target) => options.onRecorded?.(target.sessionDirectory),
    });
  }

  state(): ClipboardCaptureState {
    const { enabled, paused, lastEventAt } = this.recorder.state();
    return { enabled, paused, lastEventAt };
  }

  /** `true` when the polling timer is running. */
  get polling(): boolean {
    return this.recorder.state().polling;
  }

  configure(request: ClipboardConfigureRequest): ClipboardCaptureState {
    this.recorder.configure(request);
    return this.state();
  }

  /** Throws if `sessionDirectory` is not a valid session directory inside the data repository. */
  setActive(sessionDirectory: string | null): ClipboardCaptureState {
    if (sessionDirectory !== null) {
      resolveSessionDirectory(this.options.dataRepoPath, sessionDirectory);
    }
    this.recorder.setActiveSession(sessionDirectory);
    return this.state();
  }

  clear(): ClipboardCaptureState {
    this.recorder.clearDedupe();
    return this.state();
  }

  /** Pruning: if the ended session was active, capture stops writing to it. */
  sessionEnded(sessionDirectory: string): void {
    if (this.recorder.state().activeSessionId === sessionDirectory) {
      this.recorder.setActiveSession(null);
    }
  }

  dispose(): void {
    this.recorder.dispose();
  }
}
