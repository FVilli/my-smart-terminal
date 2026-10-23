import { app, type BrowserWindow } from 'electron';

const IPC_SCRIPT = `(async () => {
  const api = window.smartTerminal;
  const invoke = window.__testInvoke;
  const rejects = async (fn) => { try { await fn(); return false; } catch { return true; } };
  const ui = { title: document.title, text: document.body.innerText.slice(0, 300) };
  const hasApi = typeof api === 'object' && api !== null && typeof invoke === 'function';
  const ping = await api.ping();
  const info = await api.runtimeInfo();
  return {
    ui,
    hasApi,
    pingOk: typeof ping.appVersion === 'string' && typeof ping.platform === 'string',
    runtimeInfoOk: typeof info.appVersion === 'string' && typeof info.isPackaged === 'boolean',
    invalidPayloadRejected:
      (await rejects(() => invoke('app:ping', { a: 1 }))) &&
      (await rejects(() => invoke('app:ping', 'x'))) &&
      (await rejects(() => invoke('app:ping', null))) &&
      (await rejects(() => invoke('app:runtime-info', 1))),
    unknownChannelRejected: await rejects(() => invoke('app:does-not-exist')),
    requireUndefined: typeof require === 'undefined',
    processUndefined: typeof process === 'undefined',
    exposedKeys: Object.keys(api).sort(),
  };
})()`;

const EXPECTED_KEYS = [
  'closeTerminal',
  'createTerminal',
  'listTerminals',
  'onTerminalData',
  'onTerminalExit',
  'ping',
  'resizeTerminal',
  'runtimeInfo',
  'writeTerminal',
].join(',');

const PTY_SCRIPT = `(async () => {
  const api = window.smartTerminal;
  const isWindows = ${JSON.stringify(process.platform === 'win32')};
  const marker = 'SMART_PTY_OK';
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, timeoutMs) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return true;
      await sleep(50);
    }
    return predicate();
  };
  let output = '';
  let exitEvent = null;
  let sessionId = null;
  const offData = api.onTerminalData((e) => { if (e.sessionId === sessionId) output += e.data; });
  const offExit = api.onTerminalExit((e) => { if (e.sessionId === sessionId) exitEvent = e; });
  const result = { created: false, promptOutput: false, markerSeen: false, resizeOk: false, listed: false, exited: false };
  try {
    const info = await api.createTerminal({ kind: 'local', cols: 80, rows: 24 });
    sessionId = info.sessionId;
    result.created = typeof sessionId === 'string' && Number.isInteger(info.pid);
    result.promptOutput = await waitFor(() => output.length > 0, 8000);
    await sleep(300);
    const command = isWindows ? "Write-Output ('SMART_PTY_' + 'OK')\\r" : "printf 'SMART_PTY_%s\\\\n' OK\\r";
    await api.writeTerminal({ sessionId, data: command });
    result.markerSeen = await waitFor(() => output.includes(marker), 8000);
    try { await api.resizeTerminal({ sessionId, cols: 100, rows: 30 }); result.resizeOk = true; } catch {}
    result.listed = (await api.listTerminals()).some((s) => s.sessionId === sessionId);
    await api.closeTerminal({ sessionId });
    result.exited = await waitFor(() => exitEvent !== null, 8000);
  } finally {
    offData();
    offExit();
  }
  return { ...result, exitEvent: exitEvent !== null };
})()`;

/** Smoke attivo con SMART_TERMINAL_SMOKE=1 (IPC) o SMART_TERMINAL_PTY_SMOKE=1 (PTY): stampa il risultato ed esce con 0/1. */
export function runSmoke(window: BrowserWindow, mode: 'ipc' | 'pty' = 'ipc'): void {
  if (mode === 'pty') {
    window.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        void window.webContents
          .executeJavaScript(PTY_SCRIPT)
          .then((result: Record<string, boolean>) => {
            const ok = Object.values(result).every((value) => value === true);
            console.log('SMART_TERMINAL_PTY_SMOKE_RESULT', JSON.stringify({ ...result, ok }));
            app.exit(ok ? 0 : 1);
          })
          .catch((error: unknown) => {
            console.error('SMART_TERMINAL_SMOKE_ERROR', error);
            app.exit(1);
          });
      }, 1200);
    });
    return;
  }

  window.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void window.webContents
        .executeJavaScript(IPC_SCRIPT)
        .then((result: Record<string, unknown> & { ui: unknown; exposedKeys: string[] }) => {
          const { ui, exposedKeys, ...checks } = result;
          const keysOk = exposedKeys.join(',') === EXPECTED_KEYS;
          const ok = keysOk && Object.values(checks).every((value) => value === true);
          console.log('SMART_TERMINAL_SMOKE_RESULT', JSON.stringify({ ...(ui as object), hasApi: checks['hasApi'] }));
          console.log('SMART_TERMINAL_IPC_SMOKE_RESULT', JSON.stringify({ ...checks, exposedKeysOk: keysOk, ok }));
          app.exit(ok ? 0 : 1);
        })
        .catch((error: unknown) => {
          console.error('SMART_TERMINAL_SMOKE_ERROR', error);
          app.exit(1);
        });
    }, 1200);
  });
}
