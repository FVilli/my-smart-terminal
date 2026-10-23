import { app, BrowserWindow, net, protocol } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TEST_IPC_ARGUMENT } from '@smart-terminal/contracts';
import { registerIpcHandlers, trackIpcWindow } from './ipc-electron';
import { NodePtyAdapter } from '@smart-terminal/terminal/node-pty';
import { readWindowSize, runCapture } from './capture';
import { runClipboardSmoke, runEditorSmoke, runSearchSmoke, runSidebarSmoke, runSmoke, runTabsSmoke } from './smoke';
import { DataRuntime } from './data-runtime';
import { ClipboardService } from './clipboard-service';
import { electronClipboardSource } from './electron-clipboard';
import { HistoryService } from './history-service';
import { SearchService } from './search-service';
import { TerminalHost } from './terminal-host';

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
const ptySmokeTest = process.env['SMART_TERMINAL_PTY_SMOKE'] === '1';
const tabsSmokeTest = process.env['SMART_TERMINAL_TABS_SMOKE'] === '1';
const editorSmokeTest = process.env['SMART_TERMINAL_EDITOR_SMOKE'] === '1';
const sidebarSmokeTest = process.env['SMART_TERMINAL_SIDEBAR_SMOKE'] === '1';
const clipboardSmokeTest = process.env['SMART_TERMINAL_CLIPBOARD_SMOKE'] === '1';
const searchSmokeTest = process.env['SMART_TERMINAL_SEARCH_SMOKE'] === '1';
const capturePath = process.env['SMART_TERMINAL_CAPTURE'];
const ipcSenderIds = new Set<number>();
let terminalHost: TerminalHost | undefined;
let clipboardService: ClipboardService | undefined;

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
    ...readWindowSize(),
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#171e25',
    show: false,
    title: 'Smart Terminal',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      additionalArguments: smokeTest || ptySmokeTest ? [TEST_IPC_ARGUMENT] : [],
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

  if (terminalHost === undefined) {
    throw new Error('Terminal host not initialised');
  }
  trackIpcWindow(window, ipcSenderIds, terminalHost);

  if (capturePath) {
    runCapture(window, capturePath);
  }

  if (tabsSmokeTest) {
    runTabsSmoke(window);
  }

  if (editorSmokeTest) {
    runEditorSmoke(window);
  }

  if (sidebarSmokeTest) {
    runSidebarSmoke(window);
  }

  if (searchSmokeTest) {
    runSearchSmoke(window);
  }

  if (clipboardSmokeTest) {
    runClipboardSmoke(window);
  }

  if (smokeTest || ptySmokeTest) {
    runSmoke(window, ptySmokeTest ? 'pty' : 'ipc');
  }

  return window;
}

app.whenReady().then(() => {
  const dataRuntime = new DataRuntime({ userDataPath: app.getPath('userData') });
  const host = new TerminalHost(new NodePtyAdapter(), dataRuntime);
  terminalHost = host;
  const search = new SearchService(dataRuntime.dataRepoPath);
  dataRuntime.onSessionEnded((sessionDirectory) => search.upsertSession(sessionDirectory));
  const history = new HistoryService({
    dataRepoPath: dataRuntime.dataRepoPath,
    resolveSession: (senderId, sessionId) => host.resolveSession(senderId, sessionId),
    onRecorded: (sessionDirectory) => search.upsertSession(sessionDirectory),
  });
  const clipboardCapture = new ClipboardService({
    dataRepoPath: dataRuntime.dataRepoPath,
    source: electronClipboardSource,
    resolveSession: (senderId, sessionId) => host.resolveSession(senderId, sessionId),
    initiallyEnabled: process.env['SMART_TERMINAL_CLIPBOARD'] === '1',
    onRecorded: (sessionDirectory) => search.upsertSession(sessionDirectory),
  });
  clipboardService = clipboardCapture;
  registerAppProtocol();
  registerIpcHandlers(() => ipcSenderIds, devServerUrl, `${APP_SCHEME}://${APP_HOST}/`, host, { history, clipboard: clipboardCapture, search });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  clipboardService?.dispose();
  terminalHost?.closeAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
