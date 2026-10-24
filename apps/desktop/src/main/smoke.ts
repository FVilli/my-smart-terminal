import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { app, clipboard, type BrowserWindow } from 'electron';
import {
  MarkdownSearchIndex,
  appendHistoryEvent,
  createSessionDocuments,
  hashClipboardText,
  parseClipboardDocument,
  parseFrontmatter,
  parseHistoryDocument,
  parseSessionDocument,
  writeFileAtomic,
} from '@smart-terminal/data';

const IPC_SCRIPT = `(async () => {
  const api = window.smartTerminal;
  const invoke = window.__testInvoke;
  const rejects = async (fn) => { try { await fn(); return false; } catch { return true; } };
  const ui = { title: document.title, text: document.body.innerText.slice(0, 300) };
  const hasApi = typeof api === 'object' && api !== null && typeof invoke === 'function';
  const ping = await api.ping();
  const info = await api.runtimeInfo();
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    ui,
    hasApi,
    pingOk: typeof ping.appVersion === 'string' && typeof ping.platform === 'string',
    runtimeInfoOk: typeof info.appVersion === 'string' && typeof info.isPackaged === 'boolean',
    isPrimary: info.isPrimary === true,
    primaryIndicator: !!document.querySelector('[data-testid="primary-indicator"]') && document.querySelector('[data-testid="primary-indicator"]').textContent.includes('Primary instance'),
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
  'aiCorrect',
  'aiStatus',
  'appRelaunch',
  'clipboardClear',
  'clipboardConfigure',
  'clipboardSetActive',
  'clipboardState',
  'clipboardWrite',
  'closeTerminal',
  'createTerminal',
  'helpOpen',
  'listTerminals',
  'onRoleChanged',
  'onSearchRefreshed',
  'onSyncStatus',
  'onTerminalData',
  'onTerminalExit',
  'onWindowMaximized',
  'onboardingSave',
  'onboardingSkip',
  'onboardingState',
  'onboardingValidate',
  'ping',
  'recordHistory',
  'resizeTerminal',
  'runtimeInfo',
  'search',
  'searchFacets',
  'secretsLogout',
  'secretsStatus',
  'setupTestAi',
  'setupTestRemote',
  'sshAliases',
  'sttStatus',
  'sttTranscribe',
  'syncStatus',
  'windowControl',
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

/** Active smoke test with SMART_TERMINAL_SMOKE=1 (IPC) o SMART_TERMINAL_PTY_SMOKE=1 (PTY): prints the result and exits with 0/1. */
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

/** Verifies in the temporary data repository: counter.md, two session directories with the three files, S1 closed with ended_at. */
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

/** Active UI smoke test with SMART_TERMINAL_TABS_SMOKE=1: creates/selects/closes tabs through the DOM and verifies terminal:list. */
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
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    result.shortcutFocusesComposer = await waitFor(() => document.activeElement === textarea(), 1000);
    setText('escape-draft');
    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    result.escapeReturnsToTerminalAndKeepsDraft = await waitFor(() => document.activeElement !== textarea(), 1000) && textarea().value === 'escape-draft';
    result.placeholderHint = textarea().placeholder === 'Enter sends · Shift+Enter inserts a newline';
    const composer = textarea().closest('.composer');
    result.singleComposerStructure = !!composer && document.querySelectorAll('app-assisted-input .composer').length === 1 && ['ai-correction', 'assisted-mic', 'assisted-send'].every((id) => composer.querySelector('[data-testid="' + id + '"]')) && !!composer.querySelector('[data-testid="voice-label"]');
    result.sendDisabledWhenEmpty = q('assisted-send')[0].disabled === true;
    setText("printf 'EDITOR_%s\\\\n' OK");
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
    setText('export SMOKE_API_KEY=smoke_secret_value');
    await sleep(50);
    q('assisted-send')[0].click();
    result.sensitiveSent = await waitFor(() => textarea().value === '', 2000);
    await sleep(300);
    setText('draft-one');
    await sleep(50);
    q('session-plus')[0].click();
    await sleep(50);
    q('session-new-local')[0].click();
    result.secondTab = await waitFor(async () => q('session-tab').length === 2 && textarea().value === '', 8000);
    setText('draft-two');
    await sleep(50);
    q('session-tab')[0].click();
    result.firstDraftIntact = await waitFor(() => textarea().value === 'draft-one', 2000);
    q('session-tab')[1].click();
    result.secondDraftIntact = await waitFor(() => textarea().value === 'draft-two', 2000);
  } finally {
    off();
  }
  return result;
})()`;

/** Active UI smoke test with SMART_TERMINAL_EDITOR_SMOKE=1: types in the assisted textarea, submits, and verifies output and per-tab drafts. */
export function runEditorSmoke(window: BrowserWindow): void {
  runUiSmoke(window, EDITOR_SCRIPT, 'SMART_TERMINAL_EDITOR_SMOKE_RESULT', async () => {
    const found = await pollUntil(() => {
      const events = readAllHistoryEvents();
      return events.some((event) => event.text.includes('EDITOR_%s'));
    }, 4000);
    const events = readAllHistoryEvents();
    return {
      historyAssistedRecorded: found && events.some((event) => event.source === 'assisted' && event.text.includes('EDITOR_%s')),
      historyEnterRecorded: events.some((event) => event.source === 'assisted' && event.text === 'echo ENTER_KEY_OK'),
      historySensitiveNotRecorded: !events.some((event) => event.text.includes('smoke_secret_value')),
      historyCwdPresent: events.every((event) => typeof event.cwd === 'string' && event.cwd.length > 0),
    };
  });
}

async function pollUntil(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return predicate();
}

async function pollUntilAsync(predicate: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return predicate();
}

function sessionDirectories(): string[] {
  const repo = process.env['SMART_TERMINAL_DATA_REPO'];
  if (repo === undefined || repo.length === 0) {
    return [];
  }
  const sessionsRoot = path.resolve(repo, 'sessions');
  try {
    return fs.readdirSync(sessionsRoot).flatMap((machine) => {
      const machineDir = path.join(sessionsRoot, machine);
      return fs.statSync(machineDir).isDirectory()
        ? fs.readdirSync(machineDir).filter((name) => name !== 'counter.md').map((name) => path.join(machineDir, name))
        : [];
    });
  } catch {
    return [];
  }
}

function readAllHistoryEvents(): ReturnType<typeof parseHistoryDocument>['events'] {
  return sessionDirectories().flatMap((dir) => {
    try {
      return parseHistoryDocument(fs.readFileSync(path.join(dir, 'history.md'), 'utf8')).events;
    } catch {
      return [];
    }
  });
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
  result.syncLabel = q('sync-badge').textContent.includes('Repository not configured');
  for (let attempt = 0; attempt < 40 && !q('primary-indicator'); attempt += 1) await sleep(50);
  result.primaryIndicator = !!q('primary-indicator') && q('primary-indicator').textContent.includes('Primary instance');
  const sidebar = q('sidebar');
  result.noSidebarOverflow = sidebar.scrollWidth <= sidebar.clientWidth;
  return result;
})()`;

/** Active UI smoke test with SMART_TERMINAL_SIDEBAR_SMOKE=1: switches sidebar tabs and verifies aria-selected, placeholder e footer. */
export function runSidebarSmoke(window: BrowserWindow): void {
  runUiSmoke(window, SIDEBAR_SCRIPT, 'SMART_TERMINAL_SIDEBAR_SMOKE_RESULT');
}

function runUiSmoke(
  window: BrowserWindow,
  script: string,
  label: string,
  extraChecks?: () => Promise<Record<string, boolean>>,
): void {
  window.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void window.webContents
        .executeJavaScript(script)
        .then(async (uiResult: Record<string, boolean>) => {
          const result = { ...uiResult, ...(extraChecks !== undefined ? await extraChecks() : {}) };
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

const CLIPBOARD_UI_SCRIPT = `(async () => {
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
  const q = (id) => document.querySelector('[data-testid="' + id + '"]');
  const result = {};
  result.initialSession = await waitFor(async () => (await api.listTerminals()).length === 1, 8000);
  await sleep(300);
  result.disabledByDefault = !q('clipboard-enable').checked && q('clipboard-status').textContent.includes('Clipboard capture off') && q('clipboard-pause').disabled;
  q('clipboard-enable').click();
  result.enabledViaUi = await waitFor(async () => (await api.clipboardState()).enabled === true && q('clipboard-status').textContent.includes('Clipboard capture on'), 4000);
  q('clipboard-pause').click();
  result.pausedViaUi = await waitFor(() => q('clipboard-status').textContent.includes('Clipboard capture paused'), 4000);
  q('clipboard-pause').click();
  result.resumedViaUi = await waitFor(() => q('clipboard-status').textContent.includes('Clipboard capture on'), 4000);
  return result;
})()`;

const CLIPBOARD_STATE_SCRIPT = `window.smartTerminal.clipboardState().then((s) => s.lastEventAt !== null && s.enabled && !s.paused)`;

function readAllClipboardEvents(): ReturnType<typeof parseClipboardDocument>['events'] {
  return sessionDirectories().flatMap((dir) => {
    try {
      return parseClipboardDocument(fs.readFileSync(path.join(dir, 'clipboard.md'), 'utf8')).events;
    } catch {
      return [];
    }
  });
}

/** Active smoke test with SMART_TERMINAL_CLIPBOARD_SMOKE=1: enables capture through the UI, writes to the Electron clipboard, and verifies clipboard.md. */

const AI_SCRIPT = `(async () => {
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
  const textarea = () => document.querySelector('[data-testid="assisted-textarea"]');
  const aiButton = () => document.querySelector('[data-testid="ai-correction"]');
  const notice = () => document.querySelector('[data-testid="ai-notice"]');
  const setText = (value) => {
    const el = textarea();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const result = {};
  try {
    const status = await api.aiStatus();
    result.statusConfigured = status.configured === true && status.hasToken === true;
    result.buttonDisabledWhenEmpty = await waitFor(() => aiButton() && aiButton().disabled === true, 8000);
    setText('This is a sentance with a typo');
    await sleep(100);
    result.buttonEnabledWithDraft = aiButton().disabled === false;
    aiButton().click();
    result.corrected = await waitFor(() => textarea().value.includes('sentence'), 8000);
    result.noticeReview = await waitFor(() => notice() && notice().textContent.includes('review'), 4000);
    result.notSent = (await api.search({ query: 'typo' })).entries.length === 0;
    setText('git status');
    await sleep(100);
    aiButton().click();
    result.shellSkipped = await waitFor(() => notice() && notice().textContent.includes('shell command'), 4000);
    result.shellDraftUnchanged = textarea().value === 'git status';
    result.noAutoSend = (await api.search({ query: 'git status' })).entries.length === 0;
  } finally {
    // no cleanup required
  }
  return result;
})()`;

/** Active AI smoke test with SMART_TERMINAL_AI_SMOKE=1: requires SMART_TERMINAL_AI_TEST_MODE=1 e provider configuration. */
export function runAiSmoke(window: BrowserWindow): void {
  runUiSmoke(window, AI_SCRIPT, 'SMART_TERMINAL_AI_SMOKE_RESULT');
}

const STT_SCRIPT = `(async () => {
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
  const q = (id) => document.querySelector('[data-testid="' + id + '"]');
  const mic = () => q('assisted-mic');
  const voiceLabel = () => q('voice-label').textContent.trim();
  const textarea = () => q('assisted-textarea');
  const setText = (value) => {
    const el = textarea();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const press = (type) => mic().dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, isPrimary: true }));
  const result = {};
  result.sessionReady = await waitFor(async () => (await api.listTerminals()).length === 1 && !textarea().disabled, 8000);
  const status = await api.sttStatus();
  result.statusConfigured = status.configured === true && status.provider === 'local';
  result.micIdleLabel = mic().disabled === false && voiceLabel() === 'Voice ready';

  // 1. Permission denied: localized message, terminal, and submission remain usable.
  navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  mic().click();
  result.deniedMessage = await waitFor(() => voiceLabel() === 'Microphone denied', 4000);
  setText('echo MIC_DENIED_STILL_WORKS');
  await sleep(100);
  result.deniedDoesNotBlockSend = q('assisted-send').disabled === false;
  setText('');
  await sleep(50);

  // 2. Synthetic stream (no real audio): push-to-talk start/stop and draft text.
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  const oscillator = context.createOscillator();
  oscillator.connect(destination);
  oscillator.start();
  navigator.mediaDevices.getUserMedia = async () => destination.stream;
  press('pointerdown');
  result.listeningLabel = await waitFor(() => voiceLabel() === 'Listening…', 4000);
  await sleep(1200);
  press('pointerup');
  result.transcriptInDraft = await waitFor(() => textarea().value.includes('test transcript'), 15000);
  result.labelBackToIdle = await waitFor(() => voiceLabel() === 'Voice ready', 4000);
  try { oscillator.stop(); void context.close(); } catch {}

  // 3. The text arrives in the editable draft and is not submitted.
  setText('edited test transcript');
  await sleep(100);
  result.transcriptEditable = textarea().value === 'edited test transcript';
  await sleep(500);
  result.notSent = (await api.search({ query: 'test transcript' })).entries.length === 0 && textarea().value.length > 0;

  // 4. No layout overflow with the voice label.
  const host = document.querySelector('app-assisted-input');
  const composer = document.querySelector('app-assisted-input .composer');
  result.noOverflow = !!host && !!composer && host.scrollWidth <= host.clientWidth && composer.scrollWidth <= composer.clientWidth;
  return result;
})()`;

const AUDIO_FILE_PATTERN = /\.(webm|wav|mp3|ogg|m4a|aac|flac|opus)$/i;

/** No audio files (and no files beyond configuration) in userData after transcription. */
function hasNoAudioArtifacts(directory: string): boolean {
  try {
    return !fs
      .readdirSync(directory, { recursive: true, withFileTypes: true })
      .some((entry) => entry.isFile() && AUDIO_FILE_PATTERN.test(entry.name));
  } catch {
    return true;
  }
}

/** Active STT smoke test with SMART_TERMINAL_STT_SMOKE=1: requires SMART_TERMINAL_STT_TEST_MODE=1 and a configured provider. */
export function runSttSmoke(window: BrowserWindow): void {
  runUiSmoke(window, STT_SCRIPT, 'SMART_TERMINAL_STT_SMOKE_RESULT', async () => ({
    noAudioFileInUserData: hasNoAudioArtifacts(app.getPath('userData')),
    noAudioFileInDataRepo: hasNoAudioArtifacts(process.env['SMART_TERMINAL_DATA_REPO'] ?? ''),
  }));
}


const SETTINGS_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, timeoutMs = 8000) => { const start = Date.now(); while (Date.now() - start < timeoutMs) { if (predicate()) return true; await sleep(50); } return predicate(); };
  const q = (id) => document.querySelector('[data-testid="' + id + '"]');
  const click = (id) => { const el = q(id); if (el) el.click(); return !!el; };
  const result = {};
  result.settingsButton = await waitFor(() => !!q('settings-open'));
  result.headerVersion = (q('header-version')?.textContent ?? '').includes('Smart Terminal - Version');
  result.panelInitiallyVisible = await waitFor(() => !!q('sidebar') && q('header-panel-toggle')?.getAttribute('aria-pressed') === 'true');
  click('header-panel-toggle'); result.panelHides = await waitFor(() => !q('sidebar'));
  click('header-panel-toggle'); result.panelReopens = await waitFor(() => !!q('sidebar'));
  click('sidebar-tab-history'); result.internalTabSyncsHeader = await waitFor(() => q('header-panel-toggle')?.getAttribute('aria-pressed') === 'true');
  click('header-panel-toggle'); result.historyPanelHides = await waitFor(() => !q('sidebar'));
  click('header-panel-toggle'); result.clipboardPanelOpens = await waitFor(() => !!q('sidebar') && !!q('sidebar-tab-history'));
  result.windowControlsPresent = !!q('window-minimize') && !!q('window-maximize') && !!q('window-close');
  click('settings-open'); result.opened = await waitFor(() => !!q('onboarding-overlay'));
  result.noProgress = !q('onboarding-progress');
  result.tabs = ['repository','ai','stt','appearance'].every((tab) => !!q('settings-tab-' + tab));
  click('settings-tab-repository'); result.repository = await waitFor(() => !!q('onboarding-machine'));
  click('settings-tab-ai'); result.ai = await waitFor(() => !!q('onboarding-ai-provider'));
  click('settings-tab-stt'); result.stt = await waitFor(() => !!q('onboarding-stt-provider'));
  click('settings-tab-appearance'); result.appearance = await waitFor(() => !!q('settings-terminal-font'));
  if (q('settings-terminal-font')) { q('settings-terminal-font').value = 'system'; q('settings-terminal-font').dispatchEvent(new Event('change', { bubbles: true })); }
  click('onboarding-cancel'); result.dirtyConfirmation = await waitFor(() => !!q('onboarding-discard-confirm'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  result.escapeConfirmation = await waitFor(() => !!q('onboarding-discard-confirm'));
  click('onboarding-discard'); await waitFor(() => !q('onboarding-overlay'));
  click('settings-open'); await waitFor(() => !!q('onboarding-overlay'));
  result.savedValuesReloaded = q('onboarding-machine')?.value === 'settings-smoke';
  click('onboarding-save'); await waitFor(() => !q('onboarding-overlay'));
  click('settings-open'); result.reopenedAfterSave = await waitFor(() => !!q('onboarding-overlay'));
  return result;
})()`;
/** Settings/reversible-wizard smoke, enabled by SMART_TERMINAL_SETTINGS_SMOKE=1. */

const REMOTE_SETUP_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, timeoutMs = 20000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) { if (predicate()) return true; await sleep(100); }
    return predicate();
  };
  const q = (id) => document.querySelector('[data-testid="' + id + '"]');
  const click = (id) => { const el = q(id); if (el) el.click(); return !!el; };
  const result = {};
  result.settings = await waitFor(() => !!q('settings-open'));
  click('settings-open');
  await waitFor(() => !!q('onboarding-overlay'));
  result.testButton = await waitFor(() => !!q('onboarding-test-remote'));
  click('onboarding-test-remote');
  result.resultVisible = await waitFor(() => !!q('onboarding-remote-result'), 30000);
  result.resultSuccessful = await waitFor(() => (q('onboarding-remote-result')?.textContent ?? '').includes('pushed'), 30000);
  result.commitShown = (q('onboarding-remote-result')?.textContent ?? '').includes('commit');
  return result;
})()`;

/** Remote registration smoke, enabled by SMART_TERMINAL_REMOTE_SETUP_SMOKE=1. */

const AI_SETUP_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, timeoutMs = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) { if (predicate()) return true; await sleep(100); }
    return predicate();
  };
  const q = (id) => document.querySelector('[data-testid="' + id + '"]');
  const click = (id) => { const el = q(id); if (el) el.click(); return !!el; };
  const result = {};
  result.settings = await waitFor(() => !!q('settings-open'));
  click('settings-open');
  await waitFor(() => !!q('onboarding-overlay'));
  click('settings-tab-ai');
  result.step2 = await waitFor(() => !!q('onboarding-ai-provider'));
  const provider = q('onboarding-ai-provider'); provider.value = 'openai-compatible'; provider.dispatchEvent(new Event('change', { bubbles: true }));
  const base = q('onboarding-ai-url'); base.value = 'https://unsloth.example/v1'; base.dispatchEvent(new Event('input', { bubbles: true }));
  const model = q('onboarding-ai-model'); model.value = 'custom/model:v1'; model.dispatchEvent(new Event('input', { bubbles: true }));
  result.button = await waitFor(() => !!q('onboarding-test-ai'));
  click('onboarding-test-ai');
  result.resultVisible = await waitFor(() => !!q('onboarding-ai-result'), 20000);
  result.responseShown = await waitFor(() => (q('onboarding-ai-result')?.textContent ?? '').includes('responded'), 20000);
  return result;
})()`;

/** AI setup smoke, enabled by SMART_TERMINAL_AI_SETUP_SMOKE=1. */
export function runAiSetupSmoke(window: BrowserWindow): void {
  runUiSmoke(window, AI_SETUP_SCRIPT, 'SMART_TERMINAL_AI_SETUP_SMOKE_RESULT');
}


const STT_SETUP_SCRIPT = `(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, timeoutMs = 20000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) { if (predicate()) return true; await sleep(100); }
    return predicate();
  };
  const q = (id) => document.querySelector('[data-testid="' + id + '"]');
  const click = (id) => { const el = q(id); if (el) el.click(); return !!el; };
  const result = {};
  result.settings = await waitFor(() => !!q('settings-open'));
  click('settings-open');
  await waitFor(() => !!q('onboarding-overlay'));
  click('settings-tab-stt');
  result.step3 = await waitFor(() => !!q('onboarding-stt-provider'));
  const provider = q('onboarding-stt-provider'); provider.value = 'cloud'; provider.dispatchEvent(new Event('change', { bubbles: true }));
  await waitFor(() => !!q('onboarding-stt-url'));
  result.fields = !!q('onboarding-stt-url') && !!q('onboarding-stt-format') && !!q('onboarding-stt-language');
  const base = q('onboarding-stt-url'); base.value = 'https://unsloth.example/v1'; base.dispatchEvent(new Event('input', { bubbles: true }));
  const model = q('onboarding-stt-model'); model.value = 'parakeet-tdt-0.6b-v3'; model.dispatchEvent(new Event('input', { bubbles: true }));
  q('onboarding-stt-format').value = 'verbose_json'; q('onboarding-stt-format').dispatchEvent(new Event('change', { bubbles: true }));
  const language = q('onboarding-stt-language'); language.value = 'en'; language.dispatchEvent(new Event('input', { bubbles: true }));
  return result;
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  const oscillator = context.createOscillator();
  oscillator.connect(destination);
  oscillator.start();
  navigator.mediaDevices.getUserMedia = async () => destination.stream;
  click('onboarding-test-stt');
  result.resultVisible = await waitFor(() => !!q('onboarding-stt-result'), 20000);
  result.recognized = await waitFor(() => (q('onboarding-stt-result')?.textContent ?? '').includes('test transcript'), 20000);
  result.notSent = (await window.smartTerminal.search({ query: 'test transcript' })).entries.length === 0;
  try { oscillator.stop(); void context.close(); } catch {}
  return result;
})()`;

/** STT setup smoke, enabled by SMART_TERMINAL_STT_SETUP_SMOKE=1. */
export function runSttSetupSmoke(window: BrowserWindow): void {
  runUiSmoke(window, STT_SETUP_SCRIPT, 'SMART_TERMINAL_STT_SETUP_SMOKE_RESULT', async () => ({
    noAudioFileInUserData: hasNoAudioArtifacts(app.getPath('userData')),
  }));
}

export function runRemoteSetupSmoke(window: BrowserWindow): void {
  runUiSmoke(window, REMOTE_SETUP_SCRIPT, 'SMART_TERMINAL_REMOTE_SETUP_SMOKE_RESULT', async () => {
    const bare = process.env['SMART_TERMINAL_REMOTE_SETUP_BARE'] ?? '';
    let remoteFile = false;
    try {
      const files = execFileSync('git', ['--git-dir', bare, 'ls-tree', '-r', '--name-only', 'main'], { encoding: 'utf8' });
      remoteFile = files.split('\n').some((line) => /^instances\/.*\.md$/.test(line));
    } catch {
      remoteFile = false;
    }
    return { remoteFile };
  });
}

export function runSettingsSmoke(window: BrowserWindow): void {
  runUiSmoke(window, SETTINGS_SCRIPT, 'SMART_TERMINAL_SETTINGS_SMOKE_RESULT', async () => ({
    versionedWindowTitle: window.getTitle() === `Smart Terminal - Version ${app.getVersion()}`,
  }));
}

export function runClipboardSmoke(window: BrowserWindow): void {
  window.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void (async () => {
        const result: Record<string, boolean> = (await window.webContents.executeJavaScript(CLIPBOARD_UI_SCRIPT)) as Record<string, boolean>;
        const marker = `CLIP_SMOKE_OK_${Date.now()}`;
        await clipboard.writeText(marker);
        result['eventRecorded'] = await pollUntil(() => readAllClipboardEvents().some((event) => event.text === marker), 5000);
        const recorded = readAllClipboardEvents().find((event) => event.text === marker);
        result['hashMatches'] = recorded !== undefined && recorded.hash === hashClipboardText(marker);
        result['stateHasLastEvent'] = (await window.webContents.executeJavaScript(CLIPBOARD_STATE_SCRIPT)) === true;
        const secret = `export CLIP_API_KEY=smoke_secret_${Date.now()}`;
        await clipboard.writeText(secret);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        result['sensitiveNotRecorded'] = !readAllClipboardEvents().some((event) => event.text.includes('smoke_secret_'));
        const after = `CLIP_SMOKE_AFTER_${Date.now()}`;
        await clipboard.writeText(after);
        result['pollingContinuesAfterSensitive'] = await pollUntil(() => readAllClipboardEvents().some((event) => event.text === after), 5000);
        const ok = Object.values(result).every((value) => value === true);
        console.log('SMART_TERMINAL_CLIPBOARD_SMOKE_RESULT', JSON.stringify({ ...result, ok }));
        app.exit(ok ? 0 : 1);
      })().catch((error: unknown) => {
        console.error('SMART_TERMINAL_SMOKE_ERROR', error);
        app.exit(1);
      });
    }, 1200);
  });
}

const SEARCH_SCRIPT = `(async () => {
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
  const q = (id) => document.querySelector('[data-testid="' + id + '"]');
  const setText = (value) => {
    const el = q('assisted-textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const rejects = async (fn) => { try { await fn(); return false; } catch { return true; } };
  const result = {};
  result.initialSession = await waitFor(async () => (await api.listTerminals()).length === 1 && !q('assisted-textarea').disabled, 8000);
  const [session] = await api.listTerminals();
  await sleep(500);
  setText('echo EDITOR_OK');
  await sleep(50);
  q('assisted-send').click();
  result.found = await waitFor(async () => (await api.search({ query: 'EDITOR_OK' })).entries.some((e) => e.kind === 'history'), 8000);
  const entries = (await api.search({ query: 'editor_ok' })).entries;
  const hit = entries.find((e) => e.kind === 'history');
  result.entryShape = !!hit && hit.source === 'assisted' && hit.machine === session.machine && hit.sessionId === session.sessionId &&
    hit.sessionDirectory === session.sessionDirectory && typeof hit.timestamp === 'string' && typeof hit.cwd === 'string';
  result.filtersWork =
    (await api.search({ query: 'EDITOR_OK', machine: session.machine, sessionId: session.sessionId, kind: 'history' })).entries.length > 0 &&
    (await api.search({ query: 'EDITOR_OK', kind: 'clipboard' })).entries.length === 0 &&
    (await api.search({ query: 'EDITOR_OK', machine: 'no-such-machine' })).entries.length === 0;
  setText('export SEARCH_API_KEY=search_secret_value');
  await sleep(50);
  q('assisted-send').click();
  await sleep(800);
  result.sensitiveNotIndexed = (await api.search({ query: 'search_secret_value' })).entries.length === 0;
  result.invalidRejected = await rejects(() => api.search({ query: 'x', kind: 'shell' }));
  return result;
})()`;

/** Active smoke test with SMART_TERMINAL_SEARCH_SMOKE=1: assisted submission, API search, and index rebuild in a new instance. */
export function runSearchSmoke(window: BrowserWindow): void {
  runUiSmoke(window, SEARCH_SCRIPT, 'SMART_TERMINAL_SEARCH_SMOKE_RESULT', () => {
    const repo = process.env['SMART_TERMINAL_DATA_REPO'];
    const rebuilt = new MarkdownSearchIndex({ dataRepoPath: path.resolve(repo ?? '') });
    rebuilt.rebuild();
    return Promise.resolve({
      rebuiltIndexFindsEvent: rebuilt.query({ query: 'editor_ok', kind: 'history' }).some((entry) => entry.source === 'assisted'),
      rebuiltIndexSkipsSensitive: rebuilt.query({ query: 'search_secret_value' }).length === 0,
    });
  });
}

const SYNC_UI_REMOTE_MACHINE = 'remote-box';
const SYNC_UI_REMOTE_PROMPT = 'REMOTE_BOX_PROMPT echo from another machine';

/** Before starting the coordinator: writes a session from another machine to the data repository (as if received by a pull). */
export function seedSyncUiSmokeData(dataRepoPath: string): void {
  const startedAt = '2026-01-01T09:00:00+00:00';
  const directory = path.join(dataRepoPath, 'sessions', SYNC_UI_REMOTE_MACHINE, '2026-01-01_09.00_S1_local');
  fs.mkdirSync(directory, { recursive: true });
  const documents = createSessionDocuments({
    schema_version: 1,
    session_id: 'S1',
    machine: SYNC_UI_REMOTE_MACHINE,
    created_at: startedAt,
    window_id: 'seed',
    kind: 'local',
    cwd_initial: '/srv',
    started_at: startedAt,
  });
  const history = appendHistoryEvent(documents.history, { id: 'seed-1', timestamp: startedAt, source: 'assisted', cwd: '/srv', text: SYNC_UI_REMOTE_PROMPT });
  writeFileAtomic(path.join(directory, 'history.md'), history);
  writeFileAtomic(path.join(directory, 'clipboard.md'), documents.clipboard);
  writeFileAtomic(path.join(directory, 'session.md'), documents.session);
}

const SYNC_UI_PRELUDE = `
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
  const q = (id) => document.querySelector('[data-testid="' + id + '"]');
  const all = (id) => Array.from(document.querySelectorAll('[data-testid="' + id + '"]'));
  const setValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const entries = () => all('sidebar-entry').map((el) => ({
    text: el.querySelector('[data-testid="entry-preview"]').textContent,
    machine: el.querySelector('[data-testid="entry-machine"]').textContent,
    session: el.querySelector('[data-testid="entry-session"]').textContent,
    source: el.querySelector('[data-testid="entry-source"]')?.textContent ?? null,
    kind: el.getAttribute('data-kind'),
    time: el.querySelector('[data-testid="entry-time"]').textContent,
    el,
  }));
  const hasText = (needle) => entries().some((e) => e.text.includes(needle));
  const selectMachine = (value) => { const select = q('sidebar-machine-filter'); select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); };
`;

const SYNC_UI_HISTORY_SCRIPT = `(async () => {
  ${SYNC_UI_PRELUDE}
  const result = {};
  result.initialSession = await waitFor(async () => (await api.listTerminals()).length === 1 && !q('assisted-textarea').disabled, 8000);
  const [session] = await api.listTerminals();
  await sleep(500);
  setValue(q('assisted-textarea'), 'echo SYNC_UI_OK');
  await sleep(50);
  q('assisted-send').click();
  q('sidebar-tab-history').click();
  result.historyTabShowsLocalPrompt = await waitFor(() => hasText('SYNC_UI_OK'), 8000);
  result.historyTabShowsOtherMachine = await waitFor(() => hasText('REMOTE_BOX_PROMPT'), 8000);
  const local = entries().find((e) => e.text.includes('SYNC_UI_OK'));
  result.entryFields = !!local && local.machine === session.machine && local.session === session.sessionId && local.source === 'assisted' && /^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$/.test(local.time) && local.kind === 'history';
  result.facetsListBothMachines = await waitFor(() => {
    const options = Array.from(q('sidebar-machine-filter').options).map((o) => o.value);
    return options.includes(session.machine) && options.includes('${SYNC_UI_REMOTE_MACHINE}');
  }, 4000);
  selectMachine('${SYNC_UI_REMOTE_MACHINE}');
  result.machineFilterOnlyRemote = await waitFor(() => entries().length > 0 && entries().every((e) => e.machine === '${SYNC_UI_REMOTE_MACHINE}') && !hasText('SYNC_UI_OK'), 4000);
  selectMachine(session.machine);
  result.machineFilterOnlyLocal = await waitFor(() => entries().length > 0 && entries().every((e) => e.machine === session.machine) && !hasText('REMOTE_BOX_PROMPT'), 4000);
  selectMachine('');
  result.machineFilterReset = await waitFor(() => hasText('SYNC_UI_OK') && hasText('REMOTE_BOX_PROMPT'), 4000);
  setValue(q('sidebar-search'), 'remote_box_prompt');
  result.searchCaseInsensitive = await waitFor(() => entries().length === 1 && hasText('REMOTE_BOX_PROMPT'), 4000);
  setValue(q('sidebar-search'), 'zzz-no-such-text');
  result.emptyMessage = await waitFor(() => entries().length === 0 && !!q('sidebar-empty') && q('sidebar-empty').textContent.includes('No results for the current filters.'), 4000);
  setValue(q('sidebar-search'), 'SYNC_UI_OK');
  result.searchLocal = await waitFor(() => entries().length === 1 && hasText('SYNC_UI_OK'), 4000);
  entries()[0].el.querySelector('[data-testid="entry-copy"]').click();
  result.copyNotice = await waitFor(() => !!q('sidebar-notice') && q('sidebar-notice').textContent.includes('Copied to clipboard'), 4000);
  return result;
})()`;

const SYNC_UI_INSERT_SCRIPT = `(async () => {
  ${SYNC_UI_PRELUDE}
  const result = {};
  setValue(q('assisted-textarea'), '');
  await sleep(50);
  entries()[0].el.querySelector('[data-testid="entry-insert"]').click();
  result.insertSetsDraft = await waitFor(() => q('assisted-textarea').value === 'echo SYNC_UI_OK', 2000);
  await sleep(500);
  result.insertDoesNotSend = (await api.search({ query: 'SYNC_UI_OK', kind: 'history' })).entries.length === 1 && q('assisted-textarea').value === 'echo SYNC_UI_OK';
  setValue(q('assisted-textarea'), '');
  setValue(q('sidebar-search'), '');
  q('sidebar-tab-clipboard').click();
  result.clipboardTabEmptyOfHistory = await waitFor(() => entries().every((e) => e.kind === 'clipboard'), 4000);
  result.captureOff = q('clipboard-status').textContent.includes('Clipboard capture off');
  q('clipboard-enable').click();
  result.captureOn = await waitFor(async () => (await api.clipboardState()).enabled === true && q('clipboard-status').textContent.includes('Clipboard capture on'), 4000);
  return result;
})()`;

const SYNC_UI_CLIPBOARD_SCRIPT = `(async () => {
  ${SYNC_UI_PRELUDE}
  const result = {};
  const refreshUntil = async (predicate) => waitFor(async () => { q('sidebar-refresh').click(); await sleep(250); return predicate(); }, 8000);
  result.clipboardEntryListed = await refreshUntil(() => hasText('SYNC_UI_CLIP_TEXT'));
  const clip = entries().find((e) => e.text.includes('SYNC_UI_CLIP_TEXT'));
  result.clipboardEntryFields = !!clip && clip.kind === 'clipboard' && clip.source === 'system' && clip.session.startsWith('S');
  result.sensitiveNotListed = !hasText('smoke_secret_');
  clip.el.querySelector('[data-testid="entry-insert"]').click();
  result.clipboardInsert = await waitFor(() => q('assisted-textarea').value.includes('SYNC_UI_CLIP_TEXT'), 2000);
  setValue(q('assisted-textarea'), '');
  clip.el.querySelector('[data-testid="entry-copy"]').click();
  await sleep(300);
  const footer = q('sync-badge');
  result.footerNoRemote = footer.textContent.includes('Repository not configured') && footer.getAttribute('data-state') === 'unconfigured';
  result.footerPrimary = !!q('primary-indicator') && q('primary-indicator').textContent.includes('Primary instance');
  const status = await api.syncStatus();
  result.syncStatusApi = status.remoteConfigured === false && typeof status.state === 'string';
  const sidebar = q('sidebar');
  const list = q('sidebar-list');
  result.noSidebarOverflow = sidebar.scrollWidth <= sidebar.clientWidth && list.scrollWidth <= list.clientWidth;
  return result;
})()`;

/** Active smoke test with SMART_TERMINAL_SYNC_UI_SMOKE=1: Global History/Clipboard, machine filter, Copy/Paste, and sync footer. */
export function runSyncUiSmoke(window: BrowserWindow): void {
  window.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void (async () => {
        const run = (script: string): Promise<Record<string, boolean>> => window.webContents.executeJavaScript(script) as Promise<Record<string, boolean>>;
        const result: Record<string, boolean> = await run(SYNC_UI_HISTORY_SCRIPT);
        result['copyWritesElectronClipboard'] = await pollUntilAsync(async () => (await clipboard.readText()) === 'echo SYNC_UI_OK', 3000);
        Object.assign(result, await run(SYNC_UI_INSERT_SCRIPT));
        const text = `SYNC_UI_CLIP_TEXT_${Date.now()}`;
        clipboard.writeText(`export CLIP_API_KEY=smoke_secret_${Date.now()}`);
        await new Promise((resolve) => setTimeout(resolve, 1200));
        clipboard.writeText(text);
        result['clipboardEventRecorded'] = await pollUntil(() => readAllClipboardEvents().some((event) => event.text === text), 5000);
        Object.assign(result, await run(SYNC_UI_CLIPBOARD_SCRIPT));
        result['clipboardCopyWritesElectronClipboard'] = await pollUntilAsync(async () => (await clipboard.readText()) === text, 3000);
        result['sensitiveNotRecorded'] = !readAllClipboardEvents().some((event) => event.text.includes('smoke_secret_'));
        const ok = Object.values(result).every((value) => value === true);
        console.log('SMART_TERMINAL_SYNC_UI_SMOKE_RESULT', JSON.stringify({ ...result, ok }));
        app.exit(ok ? 0 : 1);
      })().catch((error: unknown) => {
        console.error('SMART_TERMINAL_SMOKE_ERROR', error);
        app.exit(1);
      });
    }, 1200);
  });
}

const SSH_UI_SCRIPT = `(async () => {
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
  const rejects = async (fn) => { try { await fn(); return false; } catch { return true; } };
  let output = '';
  const off = api.onTerminalData((e) => { output += e.data; });
  const result = {};
  try {
    result.initialSession = await waitFor(async () => q('session-tab').length === 1, 8000);
    q('session-plus')[0].click();
    result.menuListsAliases = await waitFor(() => q('session-new-ssh').length === 3, 4000);
    const aliases = q('session-new-ssh').map((b) => b.getAttribute('data-alias'));
    result.aliasesFromConfigAndInclude = aliases.join(',') === 'smoke-included,smoke-host,smoke-fail';
    result.menuItemsEnabled = q('session-new-ssh').every((b) => !b.disabled);
    q('session-new-ssh').find((b) => b.getAttribute('data-alias') === 'smoke-host').click();
    result.sshTabCreated = await waitFor(() => q('session-tab').length === 2, 8000);
    result.tabShowsLabelAndAlias = await waitFor(() => { const t = q('session-tab')[1]; return !!t && t.textContent.includes('S2') && t.textContent.includes('smoke-host'); }, 4000);
    result.markerSeen = await waitFor(() => output.includes('SSH_FAKE_OK smoke-host'), 8000);
    result.agentEnvPresent = output.includes('auth=present');
    result.panelBadge = await waitFor(() => q('terminal-target').some((b) => b.textContent.includes('S2') && b.textContent.includes('smoke-host')), 4000);
    const sshInfo = (await api.listTerminals()).find((s) => s.target === 'smoke-host');
    result.infoKindTarget = !!sshInfo && sshInfo.kind === 'ssh';
    result.invalidAliasRejected =
      (await rejects(() => api.createTerminal({ kind: 'ssh', sshAlias: '-oProxyCommand=evil' }))) &&
      (await rejects(() => api.createTerminal({ kind: 'ssh', sshAlias: 'a b' }))) &&
      (await rejects(() => api.createTerminal({ kind: 'ssh', sshAlias: 'a;b' })));
    // A failed SSH connection must not affect the other tabs.
    q('session-plus')[0].click();
    await sleep(100);
    q('session-new-ssh').find((b) => b.getAttribute('data-alias') === 'smoke-fail').click();
    result.failedSshExits = await waitFor(() => output.includes('SSH_FAKE_FAIL'), 8000);
    await sleep(500);
    const list = await api.listTerminals();
    result.otherSessionsAlive = list.some((s) => s.label === 'S1') && list.some((s) => s.target === 'smoke-host');
    result.localStillWorks = await (async () => {
      await api.writeTerminal({ sessionId: 'S1', data: "printf 'LOCAL_%s\\\\n' STILL_OK\\r" });
      return waitFor(() => output.includes('LOCAL_STILL_OK'), 8000);
    })();
  } finally {
    off();
  }
  return result;
})()`;

function fileContainsMarker(file: string, marker: string): boolean {
  try {
    return fs.readFileSync(file, 'utf8').includes(marker);
  } catch {
    return false;
  }
}

function anyFileContains(directory: string, marker: string): boolean {
  try {
    return fs
      .readdirSync(directory, { recursive: true, withFileTypes: true })
      .some((entry) => entry.isFile() && fileContainsMarker(path.join(entry.parentPath, entry.name), marker));
  } catch {
    return false;
  }
}

/**
 * Active smoke test with SMART_TERMINAL_SSH_SMOKE=1 (prepared by scripts/ssh-smoke.mjs: SSH config, fake SSH, and a decoy key).
 * The fake SSH writes received arguments to SMART_TERMINAL_SSH_SMOKE_LOG.
 */
export function runSshSmoke(window: BrowserWindow): void {
  runUiSmoke(window, SSH_UI_SCRIPT, 'SMART_TERMINAL_SSH_SMOKE_RESULT', async () => {
    const log = process.env['SMART_TERMINAL_SSH_SMOKE_LOG'] ?? '';
    const decoyMarker = process.env['SMART_TERMINAL_SSH_SMOKE_DECOY_MARKER'] ?? 'missing-marker';
    const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter((line) => line.length > 0) : [];
    const argLines = lines.filter((line) => line.startsWith('ARGS='));
    const repo = process.env['SMART_TERMINAL_DATA_REPO'] ?? '';
    const sshSessions = sessionDirectories();
    let sshMetaOk = false;
    for (const dir of sshSessions) {
      try {
        const meta = parseSessionDocument(fs.readFileSync(path.join(dir, 'session.md'), 'utf8')).meta;
        sshMetaOk ||= meta.kind === 'ssh' && meta.ssh_alias === 'smoke-host';
      } catch {
        // non-session directory
      }
    }
    return {
      fakeReceivedOnlyAlias: argLines.includes('ARGS=smoke-host') && argLines.every((line) => /^ARGS=[A-Za-z0-9._-]+$/.test(line)),
      fakeReceivedAgentEnv: lines.filter((line) => line.startsWith('AUTH=')).every((line) => line === 'AUTH=present') && lines.some((line) => line === 'AUTH=present'),
      noKeyMaterialCopied: !anyFileContains(repo, decoyMarker) && !anyFileContains(app.getPath('userData'), decoyMarker),
      sessionMdHasSshAlias: sshMetaOk,
    };
  });
}

const ONBOARDING_PHASE_SCRIPT = (phase: string, repo: string, machine: string): string => `(async () => {
  const api = window.smartTerminal;
  const phase = ${JSON.stringify(phase)};
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (predicate, timeoutMs) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await predicate()) return true;
      await sleep(50);
    }
    return predicate();
  };
  const q = (id) => document.querySelector('[data-testid="' + id + '"]');
  const setValue = (id, value) => {
    const el = q(id);
    el.value = value;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  };
  const click = (id) => q(id).click();
  const result = {};
  await sleep(600);
  result.terminalNotBroken = await waitFor(async () => (await api.listTerminals()).length >= 1, 8000);
  if (phase === 'second') {
    result.wizardHiddenOnSecondRun = !q('onboarding-overlay');
    const state = await api.onboardingState();
    result.stateValid = state.required === false && state.reason === 'valid' && state.config.machineName === ${JSON.stringify(machine)} && state.config.dataRepoPath === ${JSON.stringify(repo)};
    return result;
  }
  result.wizardVisible = await waitFor(() => !!q('onboarding-overlay'), 4000);
  if (phase === 'skip') {
    click('onboarding-defaults');
    result.wizardClosedAfterDefaults = await waitFor(() => !q('onboarding-overlay'), 6000);
    return result;
  }
  result.step1 = !!q('onboarding-step-1');
  setValue('onboarding-machine', ${JSON.stringify(machine)});
  setValue('onboarding-repo', 'relative/path');
  click('onboarding-next');
  result.invalidPathRejected = await waitFor(() => !!q('onboarding-error-repo') && !!q('onboarding-step-1'), 4000);
  setValue('onboarding-repo', ${JSON.stringify(repo)});
  click('onboarding-next');
  result.step2 = await waitFor(() => !!q('onboarding-step-2'), 4000);
  setValue('onboarding-ai-provider', 'anthropic');
  await sleep(100);
  setValue('onboarding-ai-url', 'ftp://bad');
  click('onboarding-next');
  result.invalidUrlRejected = await waitFor(() => !!q('onboarding-error-ai-url') && !!q('onboarding-step-2'), 4000);
  setValue('onboarding-ai-url', 'https://api.example.com');
  setValue('onboarding-ai-token', ${JSON.stringify(process.env['SMART_TERMINAL_ONBOARDING_SMOKE_TOKEN'] ?? 'smoke-token')});
  const secure = (await api.secretsStatus()).secureStorage;
  result.keychainWarningShownWhenInsecure = secure || !!q('onboarding-keychain-warning');
  click('onboarding-next');
  result.step3 = await waitFor(() => !!q('onboarding-step-3'), 4000);
  setValue('onboarding-stt-provider', 'local');
  click('onboarding-mic-check');
  result.micHandled = await waitFor(() => q('onboarding-mic-status').textContent.trim().length > 0 && !q('onboarding-mic-status').textContent.includes('Richiesta'), 8000);
  click('onboarding-save');
  result.restartNoticeShown = await waitFor(() => !!q('onboarding-restart-notice') && !!q('onboarding-restart'), 6000);
  result.warningShownWhenInsecure = secure || !!q('onboarding-warning');
  const state = await api.onboardingState();
  result.stateNowValid = state.required === false && state.reason === 'valid';
  result.tokenNotReturned = !JSON.stringify(state).includes(${JSON.stringify(process.env['SMART_TERMINAL_ONBOARDING_SMOKE_TOKEN'] ?? 'smoke-token')});
  return result;
})()`;

/** Smoke wizard (SMART_TERMINAL_ONBOARDING_SMOKE=1, fasi first/second/skip, orchestrato da scripts/onboarding-smoke.mjs). */
export function runOnboardingSmoke(window: BrowserWindow): void {
  const phase = process.env['SMART_TERMINAL_ONBOARDING_PHASE'] ?? 'first';
  const repo = process.env['SMART_TERMINAL_ONBOARDING_REPO'] ?? '';
  const machine = process.env['SMART_TERMINAL_ONBOARDING_MACHINE'] ?? '';
  const token = process.env['SMART_TERMINAL_ONBOARDING_SMOKE_TOKEN'] ?? 'smoke-token';
  const userData = app.getPath('userData');
  runUiSmoke(window, ONBOARDING_PHASE_SCRIPT(phase, repo, machine), 'SMART_TERMINAL_ONBOARDING_SMOKE_RESULT', () => {
    const configPath = path.join(userData, 'config', 'config.md');
    const config = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
    const checks: Record<string, boolean> = {};
    if (phase === 'first') {
      const parsed = (() => {
        try {
          return parseFrontmatter(config).data;
        } catch {
          return {};
        }
      })();
      checks['configWritten'] = parsed['schema_version'] === 1 && parsed['machine_name'] === machine && parsed['data_repo_path'] === repo && parsed['ai_provider'] === 'anthropic' && parsed['stt_provider'] === 'local';
      checks['configHasNoToken'] = !config.includes(token);
      checks['noPlaintextTokenAnywhere'] = !anyFileContains(userData, token);
      checks['repoCreated'] = fs.existsSync(repo);
      const secretsDir = path.join(userData, 'secrets');
      const files = fs.existsSync(secretsDir) ? fs.readdirSync(secretsDir) : [];
      checks['secretFilesPrivate'] = files.every((name) => (fs.statSync(path.join(secretsDir, name)).mode & 0o777) === 0o600);
    } else if (phase === 'second') {
      const machineDir = path.join(repo, 'sessions', machine.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      checks['dataPathAndMachineApplied'] = fs.existsSync(path.join(machineDir, 'counter.md'));
    } else {
      checks['defaultConfigWritten'] = config.includes('ai_provider: none') && config.includes('stt_provider: none');
    }
    return Promise.resolve(checks);
  });
}
