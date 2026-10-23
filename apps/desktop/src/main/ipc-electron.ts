import { app, ipcMain, type BrowserWindow } from 'electron';
import { createChannelMap, dispatchIpc, type IpcServices } from './ipc';
import type { TerminalHost } from './terminal-host';

/**
 * Registers channels once per process. The sender policy is
 * evaluated on every call, so windows opened later (for example, macOS
 * activate) remain valid clients without duplicating ipcMain handlers.
 */
export function registerIpcHandlers(
  getSenderIds: () => ReadonlySet<number>,
  devServerUrl: string | undefined,
  appOrigin: string,
  terminals: TerminalHost,
  services: IpcServices,
  isPrimary: () => boolean,
): void {
  const channels = createChannelMap(
    {
      appVersion: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
      isPrimary,
    },
    terminals,
    services,
  );

  for (const [channel, definition] of Object.entries(channels)) {
    ipcMain.handle(channel, (event, ...args: unknown[]) =>
      dispatchIpc(
        definition,
        {
          senderId: event.sender.id,
          isMainFrame: event.senderFrame !== null && event.senderFrame === event.sender.mainFrame,
          frameUrl: event.senderFrame?.url ?? '',
        },
        { expectedSenderIds: getSenderIds(), devServerUrl, appOrigin },
        args,
      ),
    );
  }
}

/** Registers a window as an authorized IPC client and removes it when closed. */
export function trackIpcWindow(window: BrowserWindow, senderIds: Set<number>, terminals: TerminalHost): void {
  const senderId = window.webContents.id;
  senderIds.add(senderId);
  terminals.attach(window.webContents);
  window.once('close', () => terminals.closeAllForWindow(senderId));
  window.once('closed', () => senderIds.delete(senderId));
}
