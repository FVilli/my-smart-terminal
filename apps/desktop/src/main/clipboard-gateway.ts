import type { ClipboardCaptureState, ClipboardConfigureRequest, ClipboardSetActiveRequest } from '@smart-terminal/contracts';
import type { ClipboardGateway } from './ipc';

/** Clipboard capture from the main process: performed locally when primary, through RPC otherwise (see `CoordinatorRuntime`). */
export interface ClipboardBackend {
  clipboardState(): Promise<ClipboardCaptureState>;
  clipboardConfigure(request: ClipboardConfigureRequest): Promise<ClipboardCaptureState>;
  /** `sessionDirectory` relative to the data repository, or `null` to stop capture. */
  clipboardSetActive(sessionDirectory: string | null): Promise<ClipboardCaptureState>;
  clipboardClear(): Promise<ClipboardCaptureState>;
}

export type ResolveLiveSession = (senderId: number, sessionId: string) => { sessionDirectory: string } | undefined;

/**
 * Clipboard IPC gateway: translates `sessionId` from the window to `sessionDirectory` (only live sessions from the window)
 * and delegates to the primary/secondary backend. A window can disable only the session it activated.
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
