import fs from 'node:fs';
import path from 'node:path';
import { app, type BrowserWindow } from 'electron';
import { parseSessionDocument } from '@smart-terminal/data';

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
    result.created = /^S[1-9][0-9]*$/.test(sessionId) && info.label === sessionId && Number.isInteger(info.pid) && typeof info.machine === 'string' && info.sessionDirectory.startsWith('sessions/' + info.machine + '/') && typeof info.startedAt === 'string';
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

const TABS_SCRIPT = `(async () => {
  const api = window.smartTerminal;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, timeoutMs) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await predicate()) return true;
      await sleep(50);
    }
    return predicate();
  };
  const q = (selector) => Array.from(document.querySelectorAll('[data-testid="' + selector + '"]'));
  const count = async () => (await api.listTerminals()).length;
  const result = {};
  result.initialSession = await waitFor(async () => q('session-tab').length === 1 && (await count()) === 1, 8000);
  q('session-plus')[0].click();
  await sleep(50);
  q('session-new-local')[0].click();
  result.twoTabs = await waitFor(async () => q('session-tab').length === 2 && (await count()) === 2, 8000);
  result.panelsMounted = q('terminal-panel').length === 2;
  const tabs = () => q('session-tab');
  tabs()[0].click();
  await sleep(200);
  const firstActive = tabs()[0].getAttribute('aria-selected') === 'true';
  tabs()[1].click();
  await sleep(200);
  const secondActive = tabs()[1].getAttribute('aria-selected') === 'true';
  result.switchKeepsSessions = firstActive && secondActive && (await count()) === 2 && q('terminal-panel').length === 2;
  const closeButtons = q('session-tab-close');
  closeButtons[0].click();
  result.closedOne = await waitFor(async () => q('session-tab').length === 1 && (await count()) === 1, 8000);
  return result;
})()`;

/** Verifica nel repo dati temporaneo: counter.md, due directory sessione con i tre file, S1 chiusa con ended_at. */
function verifyTabsDataRepo(): boolean {
  const repo = process.env['SMART_TERMINAL_DATA_REPO'];
  if (repo === undefined || repo.length === 0) {
    return false;
  }
  try {
    const sessionsRoot = path.resolve(repo, 'sessions');
    const [machine] = fs.readdirSync(sessionsRoot);
    if (machine === undefined) {
      return false;
    }
    const machineDir = path.join(sessionsRoot, machine);
    const dirs = fs.readdirSync(machineDir).filter((name) => name !== 'counter.md').sort();
    const complete = dirs.every((dir) =>
      ['session.md', 'history.md', 'clipboard.md'].every((file) => fs.existsSync(path.join(machineDir, dir, file))),
    );
    const first = dirs.find((dir) => dir.includes('_S1_'));
    const closed =
      first !== undefined &&
      parseSessionDocument(fs.readFileSync(path.join(machineDir, first, 'session.md'), 'utf8')).meta.ended_at !== undefined;
    return fs.existsSync(path.join(machineDir, 'counter.md')) && dirs.length === 2 && complete && closed;
  } catch {
    return false;
  }
}

/** Smoke UI attivo con SMART_TERMINAL_TABS_SMOKE=1: crea/seleziona/chiude tab via DOM e verifica terminal:list. */
export function runTabsSmoke(window: BrowserWindow): void {
  window.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void window.webContents
        .executeJavaScript(TABS_SCRIPT)
        .then((uiResult: Record<string, boolean>) => {
          const result = { ...uiResult, markdownFilesCreated: verifyTabsDataRepo() };
          const ok = Object.values(result).every((value) => value === true);
          console.log('SMART_TERMINAL_TABS_SMOKE_RESULT', JSON.stringify({ ...result, ok }));
          app.exit(ok ? 0 : 1);
        })
        .catch((error: unknown) => {
          console.error('SMART_TERMINAL_SMOKE_ERROR', error);
          app.exit(1);
        });
    }, 1200);
  });
}

const EDITOR_SCRIPT = `(async () => {
  const api = window.smartTerminal;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, timeoutMs) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await predicate()) return true;
      await sleep(50);
    }
    return predicate();
  };
  const q = (id) => Array.from(document.querySelectorAll('[data-testid="' + id + '"]'));
  const textarea = () => q('assisted-textarea')[0];
  const setText = (value) => {
    const el = textarea();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  let output = '';
  const off = api.onTerminalData((e) => { output += e.data; });
  const result = {};
  try {
    result.initialSession = await waitFor(async () => q('session-tab').length === 1 && !textarea().disabled, 8000);
    await sleep(500);
    result.placeholderHint = textarea().placeholder === 'Invio invia · Shift+Invio va a capo';
    result.sendDisabledWhenEmpty = q('assisted-send')[0].disabled === true;
    setText("printf 'EDITOR_%s\\n' OK");
    await sleep(100);
    result.sendEnabledWithDraft = q('assisted-send')[0].disabled === false;
    q('assisted-send')[0].click();
    result.markerSeen = await waitFor(() => output.includes('EDITOR_OK'), 8000);
    result.draftCleared = await waitFor(() => textarea().value === '', 2000);
    result.stillEditable = textarea().disabled === false;
    setText('echo ENTER_%s');
    await sleep(50);
    const shiftEvent = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
    textarea().dispatchEvent(shiftEvent);
    result.shiftEnterNotHandled = !shiftEvent.defaultPrevented && textarea().value === 'echo ENTER_%s';
    setText('echo ENTER_KEY_OK');
    await sleep(50);
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    textarea().dispatchEvent(enterEvent);
    result.enterSubmits = enterEvent.defaultPrevented && (await waitFor(() => output.includes('ENTER_KEY_OK\\r\\n') || /\\nENTER_KEY_OK/.test(output), 8000));
    await waitFor(() => textarea().value === '', 2000);
    setText('bozza-uno');
    await sleep(50);
    q('session-plus')[0].click();
    await sleep(50);
    q('session-new-local')[0].click();
    result.secondTab = await waitFor(async () => q('session-tab').length === 2 && textarea().value === '', 8000);
    setText('bozza-due');
    await sleep(50);
    q('session-tab')[0].click();
    result.firstDraftIntact = await waitFor(() => textarea().value === 'bozza-uno', 2000);
    q('session-tab')[1].click();
    result.secondDraftIntact = await waitFor(() => textarea().value === 'bozza-due', 2000);
  } finally {
    off();
  }
  return result;
})()`;

/** Smoke UI attivo con SMART_TERMINAL_EDITOR_SMOKE=1: scrive nella textarea assistita, invia e verifica output e bozze per tab. */
export function runEditorSmoke(window: BrowserWindow): void {
  runUiSmoke(window, EDITOR_SCRIPT, 'SMART_TERMINAL_EDITOR_SMOKE_RESULT');
}

const SIDEBAR_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const q = (id) => document.querySelector('[data-testid="' + id + '"]');
  const result = {};
  const clipboard = q('sidebar-tab-clipboard');
  const history = q('sidebar-tab-history');
  const search = () => q('sidebar-search');
  result.defaultClipboard = clipboard.getAttribute('aria-selected') === 'true' && history.getAttribute('aria-selected') === 'false';
  const clipboardPlaceholder = search().placeholder;
  history.click();
  await sleep(150);
  const historyPlaceholder = search().placeholder;
  result.historySelected = history.getAttribute('aria-selected') === 'true' && clipboard.getAttribute('aria-selected') === 'false';
  clipboard.click();
  await sleep(150);
  result.clipboardSelected = clipboard.getAttribute('aria-selected') === 'true' && history.getAttribute('aria-selected') === 'false';
  result.placeholdersDiffer = clipboardPlaceholder.length > 0 && historyPlaceholder.length > 0 &&
    clipboardPlaceholder !== historyPlaceholder && search().placeholder === clipboardPlaceholder;
  result.controlsEnabled = !search().disabled && !q('sidebar-machine-filter').disabled;
  result.syncLabel = q('sync-badge').textContent.includes('GitHub synced');
  result.primaryIndicator = !!q('primary-indicator') && q('primary-indicator').textContent.includes('Primary instance');
  const sidebar = q('sidebar');
  result.noSidebarOverflow = sidebar.scrollWidth <= sidebar.clientWidth;
  return result;
})()`;

/** Smoke UI attivo con SMART_TERMINAL_SIDEBAR_SMOKE=1: cambia tab sidebar e verifica aria-selected, placeholder e footer. */
export function runSidebarSmoke(window: BrowserWindow): void {
  runUiSmoke(window, SIDEBAR_SCRIPT, 'SMART_TERMINAL_SIDEBAR_SMOKE_RESULT');
}

function runUiSmoke(window: BrowserWindow, script: string, label: string): void {
  window.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void window.webContents
        .executeJavaScript(script)
        .then((result: Record<string, boolean>) => {
          const ok = Object.values(result).every((value) => value === true);
          console.log(label, JSON.stringify({ ...result, ok }));
          app.exit(ok ? 0 : 1);
        })
        .catch((error: unknown) => {
          console.error('SMART_TERMINAL_SMOKE_ERROR', error);
          app.exit(1);
        });
    }, 1200);
  });
}
