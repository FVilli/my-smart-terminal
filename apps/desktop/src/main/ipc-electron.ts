import { app, ipcMain, type BrowserWindow } from 'electron';
import { createChannelMap, dispatchIpc } from './ipc';

/**
 * Registra i canali una sola volta per processo. La policy del sender viene
 * valutata a ogni chiamata, così le finestre aperte in seguito (es. macOS
 * activate) restano client validi senza duplicare gli handler ipcMain.
 */
export function registerIpcHandlers(
  getSenderIds: () => ReadonlySet<number>,
  devServerUrl: string | undefined,
  appOrigin: string,
): void {
  const channels = createChannelMap({
    appVersion: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
  });

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
export function trackIpcWindow(window: BrowserWindow, senderIds: Set<number>): void {
  const senderId = window.webContents.id;
  senderIds.add(senderId);
  window.once('closed', () => senderIds.delete(senderId));
}
