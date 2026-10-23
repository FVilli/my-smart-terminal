import { randomUUID } from 'node:crypto';
import type { WebContents } from 'electron';
import { IPC_EVENTS, type TerminalSessionInfo } from '@smart-terminal/contracts';
import { SessionManager, TerminalError, type PtyAdapter } from '@smart-terminal/terminal';
import type { DataRuntime } from './data-runtime';
import type { TerminalGateway } from './ipc';

type SessionDataRuntime = Pick<DataRuntime, 'createSession' | 'endSession'>;
type SessionExtras = Pick<TerminalSessionInfo, 'label' | 'machine' | 'sessionDirectory' | 'startedAt'>;

interface WindowState {
  windowId: string;
  manager: SessionManager;
  extras: Map<string, SessionExtras>;
}

/** Maintains a SessionManager (and therefore PTYs) for each window. */
export class TerminalHost implements TerminalGateway {
  private readonly windows = new Map<number, WindowState>();
  private readonly webContentsById = new Map<number, WebContents>();

  constructor(
    private readonly adapter: PtyAdapter,
    private readonly dataRuntime: SessionDataRuntime,
  ) {}

  attach(webContents: WebContents): void {
    const senderId = webContents.id;
    this.webContentsById.set(senderId, webContents);
    const dispose = (): void => this.dispose(senderId);
    webContents.once('destroyed', dispose);
  }

  /** Allocates an ID and Markdown files, then starts the PTY with the assigned ID. */
  async create(senderId: number, request: Parameters<TerminalGateway['create']>[1]): Promise<TerminalSessionInfo> {
    const state = this.stateFor(senderId);
    const { cwd } = state.manager.prepare(request);
    let created;
    try {
      created = await this.dataRuntime.createSession(state.windowId, request.kind === 'ssh' && request.sshAlias !== undefined ? { kind: 'ssh', sshAlias: request.sshAlias, cwd } : { kind: 'local', cwd });
    } catch {
      throw new TerminalError('TERMINAL_SESSION_ALLOCATION_FAILED');
    }
    const { allocation, machine } = created;
    try {
      const info = state.manager.create(request.kind === 'ssh' ? request : { ...request, cwd }, allocation.sessionId);
      const extras: SessionExtras = {
        label: allocation.label,
        machine,
        sessionDirectory: allocation.relativeDir,
        startedAt: allocation.startedAt,
      };
      state.extras.set(info.sessionId, extras);
      return { ...info, ...extras };
    } catch (error) {
      this.dataRuntime.endSession(allocation.sessionId);
      throw error instanceof TerminalError ? error : new TerminalError('TERMINAL_SPAWN_FAILED');
    }
  }

  write(senderId: number, sessionId: string, data: string): void {
    this.stateFor(senderId).manager.write(sessionId, data);
  }

  resize(senderId: number, sessionId: string, cols: number, rows: number): void {
    this.stateFor(senderId).manager.resize(sessionId, cols, rows);
  }

  close(senderId: number, sessionId: string): void {
    this.stateFor(senderId).manager.close(sessionId);
  }

  list(senderId: number): TerminalSessionInfo[] {
    const state = this.stateFor(senderId);
    return state.manager.list().flatMap((info) => {
      const extras = state.extras.get(info.sessionId);
      return extras === undefined ? [] : [{ ...info, ...extras }];
    });
  }

  /** Resolves a live session for window `senderId`; `undefined` if unknown, from another window, or terminated. */
  resolveSession(senderId: number, sessionId: string): Pick<TerminalSessionInfo, 'machine' | 'sessionDirectory'> | undefined {
    const extras = this.windows.get(senderId)?.extras.get(sessionId);
    return extras === undefined ? undefined : { machine: extras.machine, sessionDirectory: extras.sessionDirectory };
  }

  closeAllForWindow(senderId: number): void {
    const state = this.windows.get(senderId);
    if (state !== undefined) {
      this.closeState(state);
    }
  }

  closeAll(): void {
    for (const state of this.windows.values()) {
      this.closeState(state);
    }
  }

  /** Closes PTYs and immediately finalizes `ended_at`: the asynchronous exit might not arrive before the app exits. */
  private closeState(state: WindowState): void {
    const sessionIds = [...state.extras.keys()];
    state.manager.closeAll();
    for (const sessionId of sessionIds) {
      this.dataRuntime.endSession(sessionId);
    }
  }

  private dispose(senderId: number): void {
    const state = this.windows.get(senderId);
    if (state !== undefined) {
      this.closeState(state);
    }
    this.windows.delete(senderId);
    this.webContentsById.delete(senderId);
  }

  private stateFor(senderId: number): WindowState {
    const existing = this.windows.get(senderId);
    if (existing) {
      return existing;
    }
    const manager = new SessionManager({ adapter: this.adapter });
    const state: WindowState = { windowId: randomUUID(), manager, extras: new Map() };
    const send = (channel: string, payload: unknown): void => {
      const target = this.webContentsById.get(senderId);
      if (target !== undefined && !target.isDestroyed()) {
        target.send(channel, payload);
      }
    };
    manager.on('data', (event) => send(IPC_EVENTS.terminalData, event));
    manager.on('exit', (event) => {
      state.extras.delete(event.sessionId);
      this.dataRuntime.endSession(event.sessionId);
      send(IPC_EVENTS.terminalExit, event);
    });
    this.windows.set(senderId, state);
    return state;
  }
}
