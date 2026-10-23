import { app, ipcMain, type BrowserWindow } from 'electron';
import { createChannelMap, dispatchIpc, type IpcServices } from './ipc';
import type { TerminalHost } from './terminal-host';

/**
 * Registra i canali una sola volta per processo. La policy del sender viene
 * valutata a ogni chiamata, così le finestre aperte in seguito (es. macOS
 * activate) restano client validi senza duplicare gli handler ipcMain.
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

/** Registra una finestra come client IPC autorizzato e la rimuove alla chiusura. */
export function trackIpcWindow(window: BrowserWindow, senderIds: Set<number>, terminals: TerminalHost): void {
  const senderId = window.webContents.id;
  senderIds.add(senderId);
  terminals.attach(window.webContents);
  window.once('close', () => terminals.closeAllForWindow(senderId));
  window.once('closed', () => senderIds.delete(senderId));
}
