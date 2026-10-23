import { app, BrowserWindow, clipboard, net, protocol, safeStorage, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { IPC_EVENTS, TEST_IPC_ARGUMENT, type SearchQueryRequest } from '@smart-terminal/contracts';
import { registerIpcHandlers, trackIpcWindow } from './ipc-electron';
import { NodePtyAdapter } from '@smart-terminal/terminal/node-pty';
import { listSshAliases } from '@smart-terminal/terminal';
import { readWindowSize, runCapture } from './capture';
import { runAiSmoke, runClipboardSmoke, runOnboardingSmoke, runSshSmoke, runEditorSmoke, runSearchSmoke, runSidebarSmoke, runSmoke, runSttSmoke, runSyncUiSmoke, runTabsSmoke, seedSyncUiSmokeData } from './smoke';
import { AppConfigStore, resolveConfigPath } from './app-config';
import { CoordinatorRuntime, resolveGitRemote } from './coordinator-runtime';
import { OnboardingService } from './onboarding-service';
import { AiService } from './ai-service';
import { SttService } from './stt-service';
import { SecretStore } from './secret-store';
import { DataRuntime } from './data-runtime';
import { ClipboardGatewayAdapter } from './clipboard-gateway';
import { electronClipboardSource } from './electron-clipboard';
import { HistoryService } from './history-service';
import { TerminalHost } from './terminal-host';

const APP_SCHEME = 'smart-terminal';
const APP_HOST = 'bundle';

// Override test della directory utente: va impostato prima di qualunque `app.getPath('userData')`.
const userDataOverride = process.env['SMART_TERMINAL_USER_DATA'];
if (userDataOverride !== undefined && userDataOverride.length > 0) {
  app.setPath('userData', path.resolve(userDataOverride));
}

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
const aiSmokeTest = process.env['SMART_TERMINAL_AI_SMOKE'] === '1';
const sttSmokeTest = process.env['SMART_TERMINAL_STT_SMOKE'] === '1';
const syncUiSmokeTest = process.env['SMART_TERMINAL_SYNC_UI_SMOKE'] === '1';
const sshSmokeTest = process.env['SMART_TERMINAL_SSH_SMOKE'] === '1';
const onboardingSmokeTest = process.env['SMART_TERMINAL_ONBOARDING_SMOKE'] === '1';
const e2eMode = process.env['SMART_TERMINAL_E2E_MODE'];
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

  if (aiSmokeTest) {
    runAiSmoke(window);
  }

  if (sttSmokeTest) {
    runSttSmoke(window);
  }

  if (clipboardSmokeTest) {
    runClipboardSmoke(window);
  }

  if (syncUiSmokeTest) {
    runSyncUiSmoke(window);
  }

  if (sshSmokeTest) {
    runSshSmoke(window);
  }

  if (onboardingSmokeTest) {
    runOnboardingSmoke(window);
  }

  if (smokeTest || ptySmokeTest) {
    runSmoke(window, ptySmokeTest ? 'pty' : 'ipc');
  }

  return window;
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');
  // Il microfono e' l'unico permesso concesso (verifica nel wizard); tutto il resto e' negato.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const mediaTypes = (details as { mediaTypes?: string[] }).mediaTypes ?? [];
    callback(permission === 'media' && mediaTypes.length > 0 && mediaTypes.every((type) => type === 'audio'));
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'media');

  const configStore = new AppConfigStore(resolveConfigPath(userDataPath));
  const configLoad = configStore.load();
  const config = configLoad.status === 'valid' ? configLoad.config : undefined;
  const runtime = new CoordinatorRuntime({ userDataPath, clipboardSource: electronClipboardSource, config });
  if (syncUiSmokeTest) {
    seedSyncUiSmokeData(runtime.paths.dataRepoPath);
  }
  coordinatorRuntime = runtime;
  await runtime.start();
  // Le uscite via app.exit() (smoke, crash controllati) non emettono before-quit: rilascia comunque il lock primary.
  process.on('exit', () => runtime.releaseLockSync());
  runtime.onRoleChanged(() => {
    if (e2eMode === 'same-machine' || e2eMode === 'cross-machine') {
      console.log(`SMART_TERMINAL_E2E_ROLE ${JSON.stringify({ instance: process.env['SMART_TERMINAL_E2E_INSTANCE'] ?? '', isPrimary: runtime.isPrimary })}`);
    }
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

  const dataRuntime = new DataRuntime({ userDataPath, allocator: runtime.allocator, config });
  const secrets = new SecretStore(path.join(userDataPath, 'secrets'), safeStorage);
  const onboarding = new OnboardingService({
    userDataPath,
    env: process.env,
    store: configStore,
    secrets,
    runningPaths: runtime.paths,
    runningRemote: resolveGitRemote(process.env, config),
    initialLoad: configLoad,
  });
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
  if ((e2eMode === 'same-machine' || e2eMode === 'cross-machine') && process.env['SMART_TERMINAL_E2E_INSTANCE']) {
    const instance = process.env['SMART_TERMINAL_E2E_INSTANCE'];
    const marker = process.env['SMART_TERMINAL_E2E_MARKER'] ?? `e2e-${instance}-${process.pid}-${Date.now()}`;
    const created = await dataRuntime.createSession(`e2e-${instance}`, { kind: 'local', cwd: process.cwd() });
    const sessionRef = { sessionDirectory: created.allocation.relativeDir };
    const e2eHistory = new HistoryService({ dataRepoPath: dataRuntime.dataRepoPath, resolveSession: (_sender, id) => id === created.allocation.sessionId ? sessionRef : undefined, onRecorded: (dir) => runtime.notifyWrite(dir) });
    if (e2eMode !== 'cross-machine' || instance === 'A') e2eHistory.record(1, { sessionId: created.allocation.sessionId, text: marker });
    const ready = { mode: e2eMode, instance, role: runtime.isPrimary ? 'primary' : 'secondary', isPrimary: runtime.isPrimary, pid: process.pid, sessionId: created.allocation.sessionId, sessionDirectory: created.allocation.relativeDir, machine: created.machine };
    console.log(`SMART_TERMINAL_E2E_READY ${JSON.stringify(ready)}`);
    if (e2eMode === 'cross-machine' && instance !== 'A') {
      const timer = setInterval(async () => {
        const found = (await runtime.query({ query: marker })).entries.length > 0;
        console.log(`SMART_TERMINAL_E2E_SEARCH ${JSON.stringify({ instance, found, query: marker })}`);
      }, 500);
      timer.unref();
    }
    app.on('before-quit', () => dataRuntime.endSession(created.allocation.sessionId));
  }
  const ai = new AiService({
    configStore,
    secrets,
    testMode: process.env['SMART_TERMINAL_AI_TEST_MODE'] === '1',
  });
  const stt = new SttService({
    configStore,
    secrets,
    testMode: process.env['SMART_TERMINAL_STT_TEST_MODE'] === '1',
  });
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
      ssh: { aliases: () => listSshAliases() },
      onboarding,
      ai,
      stt,
      app: {
        relaunch: () => {
          terminalHost?.closeAll();
          app.relaunch();
          app.exit(0);
        },
      },
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
