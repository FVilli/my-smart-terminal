import { app, type BrowserWindow } from 'electron';

const SCRIPT = `(async () => {
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

/** Smoke attivo solo con SMART_TERMINAL_SMOKE=1: stampa il risultato ed esce con 0/1. */
export function runSmoke(window: BrowserWindow): void {
  window.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void window.webContents
        .executeJavaScript(SCRIPT)
        .then((result: Record<string, unknown> & { ui: unknown; exposedKeys: string[] }) => {
          const { ui, exposedKeys, ...checks } = result;
          const keysOk = exposedKeys.join(',') === 'ping,runtimeInfo';
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
