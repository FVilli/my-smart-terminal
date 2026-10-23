import type { WebContents } from 'electron';
import { IPC_EVENTS, type TerminalSessionInfo } from '@smart-terminal/contracts';
import { SessionManager, type PtyAdapter } from '@smart-terminal/terminal';
import type { TerminalGateway } from './ipc';

/** Mantiene un SessionManager (e quindi i PTY) per ciascuna finestra. */
export class TerminalHost implements TerminalGateway {
  private readonly managers = new Map<number, SessionManager>();
  private readonly webContentsById = new Map<number, WebContents>();

  constructor(private readonly adapter: PtyAdapter) {}

  attach(webContents: WebContents): void {
    const senderId = webContents.id;
    this.webContentsById.set(senderId, webContents);
    const dispose = (): void => this.dispose(senderId);
    webContents.once('destroyed', dispose);
  }

  create(senderId: number, request: Parameters<TerminalGateway['create']>[1]): TerminalSessionInfo {
    return this.managerFor(senderId).create(request);
  }

  write(senderId: number, sessionId: string, data: string): void {
    this.managerFor(senderId).write(sessionId, data);
  }

  resize(senderId: number, sessionId: string, cols: number, rows: number): void {
    this.managerFor(senderId).resize(sessionId, cols, rows);
  }

  close(senderId: number, sessionId: string): void {
    this.managerFor(senderId).close(sessionId);
  }

  list(senderId: number): TerminalSessionInfo[] {
    return this.managerFor(senderId).list();
  }

  closeAllForWindow(senderId: number): void {
    this.managers.get(senderId)?.closeAll();
  }

  closeAll(): void {
    for (const manager of this.managers.values()) {
      manager.closeAll();
    }
  }

  private dispose(senderId: number): void {
    this.managers.get(senderId)?.closeAll();
    this.managers.delete(senderId);
    this.webContentsById.delete(senderId);
  }

  private managerFor(senderId: number): SessionManager {
    const existing = this.managers.get(senderId);
    if (existing) {
      return existing;
    }
    const manager = new SessionManager({ adapter: this.adapter });
    const send = (channel: string, payload: unknown): void => {
      const target = this.webContentsById.get(senderId);
      if (target !== undefined && !target.isDestroyed()) {
        target.send(channel, payload);
      }
    };
    manager.on('data', (event) => send(IPC_EVENTS.terminalData, event));
    manager.on('exit', (event) => send(IPC_EVENTS.terminalExit, event));
    this.managers.set(senderId, manager);
    return manager;
  }
}
