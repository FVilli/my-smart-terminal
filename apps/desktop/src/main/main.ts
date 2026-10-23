import { app, BrowserWindow, clipboard, net, protocol } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { IPC_EVENTS, TEST_IPC_ARGUMENT, type SearchQueryRequest } from '@smart-terminal/contracts';
import { registerIpcHandlers, trackIpcWindow } from './ipc-electron';
import { NodePtyAdapter } from '@smart-terminal/terminal/node-pty';
import { readWindowSize, runCapture } from './capture';
import { runClipboardSmoke, runEditorSmoke, runSearchSmoke, runSidebarSmoke, runSmoke, runSyncUiSmoke, runTabsSmoke, seedSyncUiSmokeData } from './smoke';
import { CoordinatorRuntime } from './coordinator-runtime';
import { DataRuntime } from './data-runtime';
import { ClipboardGatewayAdapter } from './clipboard-gateway';
import { electronClipboardSource } from './electron-clipboard';
import { HistoryService } from './history-service';
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
const syncUiSmokeTest = process.env['SMART_TERMINAL_SYNC_UI_SMOKE'] === '1';
const capturePath = process.env['SMART_TERMINAL_CAPTURE'];
const ipcSenderIds = new Set<number>();
let terminalHost: TerminalHost | undefined;
let coordinatorRuntime: CoordinatorRuntime | undefined;
let coordinatorStopped = false;

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

  if (syncUiSmokeTest) {
    runSyncUiSmoke(window);
  }

  if (smokeTest || ptySmokeTest) {
    runSmoke(window, ptySmokeTest ? 'pty' : 'ipc');
  }

  return window;
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');
  const runtime = new CoordinatorRuntime({ userDataPath, clipboardSource: electronClipboardSource });
  if (syncUiSmokeTest) {
    seedSyncUiSmokeData(runtime.paths.dataRepoPath);
  }
  coordinatorRuntime = runtime;
  await runtime.start();
  // Le uscite via app.exit() (smoke, crash controllati) non emettono before-quit: rilascia comunque il lock primary.
  process.on('exit', () => runtime.releaseLockSync());
  runtime.onRoleChanged(() => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_EVENTS.roleChanged, { isPrimary: runtime.isPrimary });
    }
  });

  runtime.onSyncStatus((status) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_EVENTS.syncStatus, status);
    }
  });
  runtime.onSearchRefreshed((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_EVENTS.searchRefreshed, event);
    }
  });

  const dataRuntime = new DataRuntime({ userDataPath, allocator: runtime.allocator });
  const host = new TerminalHost(new NodePtyAdapter(), dataRuntime);
  terminalHost = host;
  const search = {
    query: (request: SearchQueryRequest) => runtime.query(request),
    facets: () => runtime.searchFacets(),
  };
  dataRuntime.onSessionEnded((sessionDirectory) => runtime.endSession(sessionDirectory));
  const history = new HistoryService({
    dataRepoPath: dataRuntime.dataRepoPath,
    resolveSession: (senderId, sessionId) => host.resolveSession(senderId, sessionId),
    onRecorded: (sessionDirectory) => runtime.notifyWrite(sessionDirectory),
  });
  const clipboardCapture = new ClipboardGatewayAdapter(runtime, (senderId, sessionId) => host.resolveSession(senderId, sessionId));
  registerAppProtocol();
  registerIpcHandlers(
    () => ipcSenderIds,
    devServerUrl,
    `${APP_SCHEME}://${APP_HOST}/`,
    host,
    {
      history,
      clipboard: clipboardCapture,
      search,
      sync: { status: () => runtime.syncStatus() },
      clipboardWriter: { writeText: (text) => clipboard.writeText(text) },
    },
    () => runtime.isPrimary,
  );
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', (event) => {
  terminalHost?.closeAll();
  if (coordinatorRuntime !== undefined && !coordinatorStopped) {
    coordinatorStopped = true;
    event.preventDefault();
    void coordinatorRuntime.stop().finally(() => app.quit());
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
