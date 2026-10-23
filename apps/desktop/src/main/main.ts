import { app, BrowserWindow, net, protocol } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TEST_IPC_ARGUMENT } from '@smart-terminal/contracts';
import { registerIpcHandlers, trackIpcWindow } from './ipc-electron';
import { runSmoke } from './smoke';

const APP_SCHEME = 'smart-terminal';
const APP_HOST = 'bundle';

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const devServerUrl = process.env['SMART_TERMINAL_DEV_SERVER_URL'];
const smokeTest = process.env['SMART_TERMINAL_SMOKE'] === '1';
const ipcSenderIds = new Set<number>();

function registerAppProtocol(): void {
  const rendererRoot = path.join(__dirname, '..', 'renderer', 'browser');

  protocol.handle(APP_SCHEME, (request) => {
    const requestUrl = new URL(request.url);
    if (requestUrl.host !== APP_HOST) {
      return new Response('Not found', { status: 404 });
    }

    const requestedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.slice(1);
    const filePath = path.resolve(rendererRoot, relativePath);

    if (filePath !== rendererRoot && !filePath.startsWith(`${rendererRoot}${path.sep}`)) {
      return new Response('Not found', { status: 404 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0b0f14',
    show: false,
    title: 'Smart Terminal',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      additionalArguments: smokeTest ? [TEST_IPC_ARGUMENT] : [],
    },
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, targetUrl) => {
    const allowed = devServerUrl ? targetUrl.startsWith(devServerUrl) : targetUrl.startsWith(`${APP_SCHEME}://`);
    if (!allowed) {
      event.preventDefault();
    }
  });

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
  }

  trackIpcWindow(window, ipcSenderIds);

  if (smokeTest) {
    runSmoke(window);
  }

  return window;
}

app.whenReady().then(() => {
  registerAppProtocol();
  registerIpcHandlers(() => ipcSenderIds, devServerUrl, `${APP_SCHEME}://${APP_HOST}/`);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
