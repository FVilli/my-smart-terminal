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
  /** Solo test: intervallo di polling. */
  intervalMs?: number;
}

/**
 * Cattura clipboard posseduta dal primary: una sola istanza (e un solo timer) per macchina.
 * La sessione attiva e' identificata dalla directory relativa `sessions/<machine>/<dir>`, validata dentro il repo dati.
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

  /** `true` se il timer di polling e' in esecuzione. */
  get polling(): boolean {
    return this.recorder.state().polling;
  }

  configure(request: ClipboardConfigureRequest): ClipboardCaptureState {
    this.recorder.configure(request);
    return this.state();
  }

  /** Lancia se `sessionDirectory` non e' una directory di sessione valida dentro il repo dati. */
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

  /** Pruning: se la sessione terminata era quella attiva, la cattura smette di scrivere in essa. */
  sessionEnded(sessionDirectory: string): void {
    if (this.recorder.state().activeSessionId === sessionDirectory) {
      this.recorder.setActiveSession(null);
    }
  }

  dispose(): void {
    this.recorder.dispose();
  }
}
