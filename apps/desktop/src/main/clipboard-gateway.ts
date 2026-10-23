import type { ClipboardCaptureState, ClipboardConfigureRequest, ClipboardSetActiveRequest } from '@smart-terminal/contracts';
import type { ClipboardGateway } from './ipc';

/** Cattura clipboard vista dal main: eseguita localmente se primary, via RPC altrimenti (vedi `CoordinatorRuntime`). */
export interface ClipboardBackend {
  clipboardState(): Promise<ClipboardCaptureState>;
  clipboardConfigure(request: ClipboardConfigureRequest): Promise<ClipboardCaptureState>;
  /** `sessionDirectory` relativa al repo dati, oppure `null` per fermare la cattura. */
  clipboardSetActive(sessionDirectory: string | null): Promise<ClipboardCaptureState>;
  clipboardClear(): Promise<ClipboardCaptureState>;
}

export type ResolveLiveSession = (senderId: number, sessionId: string) => { sessionDirectory: string } | undefined;

/**
 * Gateway IPC della clipboard: traduce `sessionId` della finestra in `sessionDirectory` (solo sessioni vive della finestra)
 * e delega al backend primary/secondary. Una finestra puo' disattivare solo la sessione che ha attivato.
 */
export class ClipboardGatewayAdapter implements ClipboardGateway {
  private activeSenderId: number | null = null;

  constructor(
    private readonly backend: ClipboardBackend,
    private readonly resolveSession: ResolveLiveSession,
  ) {}

  state(): Promise<ClipboardCaptureState> {
    return this.backend.clipboardState();
  }

  configure(request: ClipboardConfigureRequest): Promise<ClipboardCaptureState> {
    return this.backend.clipboardConfigure(request);
  }

  setActive(senderId: number, request: ClipboardSetActiveRequest): Promise<ClipboardCaptureState> {
    if (request.sessionId !== null) {
      const session = this.resolveSession(senderId, request.sessionId);
      if (session === undefined) {
        return this.backend.clipboardState();
      }
      this.activeSenderId = senderId;
      return this.backend.clipboardSetActive(session.sessionDirectory);
    }
    if (this.activeSenderId === senderId) {
      this.activeSenderId = null;
      return this.backend.clipboardSetActive(null);
    }
    return this.backend.clipboardState();
  }

  clear(): Promise<ClipboardCaptureState> {
    return this.backend.clipboardClear();
  }
}
