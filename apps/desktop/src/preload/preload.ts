import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  TEST_IPC_ARGUMENT,
  type AiCorrectRequest,
  type AiStatus,
  type AppPingResult,
  type AppRuntimeInfo,
  type ClipboardCaptureState,
  type CorrectionResult,
  type HelpTopic,
  type SetupTestAiRequest,
  type HistoryRecordResult,
  type OnboardingConfig,
  type OnboardingSaveResult,
  type OnboardingState,
  type OnboardingValidationResult,
  type SecretsStatus,
  type RemoteSetupResult,
  type RoleChangedEvent,
  type SearchFacetsResult,
  type SearchQueryResult,
  type SetupTestAiResult,
  type SearchRefreshedEvent,
  type SttStatus,
  type SttTranscribeResult,
  type SyncStatusEvent,
  type TerminalDataEvent,
  type TerminalExitEvent,
  type TerminalSessionInfo,
  type Unsubscribe,
  type WindowControlAction,
  type WindowMaximizedEvent,
  type SmartTerminalApi,
} from '@smart-terminal/contracts';

function subscribe<T>(channel: string, listener: (event: T) => void): Unsubscribe {
  const wrapped = (_event: unknown, payload: T): void => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
}

const api: SmartTerminalApi = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.appPing) as Promise<AppPingResult>,
  runtimeInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appRuntimeInfo) as Promise<AppRuntimeInfo>,
  createTerminal: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.terminalCreate, request) as Promise<TerminalSessionInfo>,
  writeTerminal: (request) => ipcRenderer.invoke(IPC_CHANNELS.terminalWrite, request) as Promise<void>,
  resizeTerminal: (request) => ipcRenderer.invoke(IPC_CHANNELS.terminalResize, request) as Promise<void>,
  closeTerminal: (request) => ipcRenderer.invoke(IPC_CHANNELS.terminalClose, request) as Promise<void>,
  listTerminals: () => ipcRenderer.invoke(IPC_CHANNELS.terminalList) as Promise<TerminalSessionInfo[]>,
  recordHistory: (request) => ipcRenderer.invoke(IPC_CHANNELS.historyRecord, request) as Promise<HistoryRecordResult>,
  clipboardState: () => ipcRenderer.invoke(IPC_CHANNELS.clipboardState) as Promise<ClipboardCaptureState>,
  clipboardConfigure: (request) => ipcRenderer.invoke(IPC_CHANNELS.clipboardConfigure, request) as Promise<ClipboardCaptureState>,
  clipboardSetActive: (request) => ipcRenderer.invoke(IPC_CHANNELS.clipboardSetActive, request) as Promise<ClipboardCaptureState>,
  clipboardClear: () => ipcRenderer.invoke(IPC_CHANNELS.clipboardClear) as Promise<ClipboardCaptureState>,
  clipboardWrite: (request) => ipcRenderer.invoke(IPC_CHANNELS.clipboardWrite, request) as Promise<void>,
  searchFacets: () => ipcRenderer.invoke(IPC_CHANNELS.searchFacets) as Promise<SearchFacetsResult>,
  syncStatus: () => ipcRenderer.invoke(IPC_CHANNELS.syncStatus) as Promise<SyncStatusEvent>,
  sshAliases: () => ipcRenderer.invoke(IPC_CHANNELS.sshAliases) as Promise<string[]>,
  onboardingState: () => ipcRenderer.invoke(IPC_CHANNELS.onboardingState) as Promise<OnboardingState>,
  onboardingValidate: (request) => ipcRenderer.invoke(IPC_CHANNELS.onboardingValidate, request) as Promise<OnboardingValidationResult>,
  onboardingSave: (request) => ipcRenderer.invoke(IPC_CHANNELS.onboardingSave, request) as Promise<OnboardingSaveResult>,
  onboardingSkip: () => ipcRenderer.invoke(IPC_CHANNELS.onboardingSkip) as Promise<OnboardingSaveResult>,
  setupTestRemote: (config: OnboardingConfig) => ipcRenderer.invoke(IPC_CHANNELS.setupTestRemote, { config }) as Promise<RemoteSetupResult>,
  secretsStatus: () => ipcRenderer.invoke(IPC_CHANNELS.secretsStatus) as Promise<SecretsStatus>,
  secretsLogout: (request) => ipcRenderer.invoke(IPC_CHANNELS.secretsLogout, request) as Promise<SecretsStatus>,
  appRelaunch: () => ipcRenderer.invoke(IPC_CHANNELS.appRelaunch) as Promise<void>,
  windowControl: (action: WindowControlAction) => ipcRenderer.invoke(IPC_CHANNELS.windowControl, { action }) as Promise<void>,
  onWindowMaximized: (listener) => subscribe<WindowMaximizedEvent>(IPC_EVENTS.windowMaximized, listener),
  aiStatus: () => ipcRenderer.invoke(IPC_CHANNELS.aiStatus) as Promise<AiStatus>,
  aiCorrect: (request: AiCorrectRequest) => ipcRenderer.invoke(IPC_CHANNELS.aiCorrect, request) as Promise<CorrectionResult>,
  setupTestAi: (request: SetupTestAiRequest) => ipcRenderer.invoke(IPC_CHANNELS.setupTestAi, request) as Promise<SetupTestAiResult>,
  helpOpen: (topic: HelpTopic) => ipcRenderer.invoke(IPC_CHANNELS.helpOpen, { topic }) as Promise<void>,
  sttStatus: () => ipcRenderer.invoke(IPC_CHANNELS.sttStatus) as Promise<SttStatus>,
  sttTranscribe: (request) => ipcRenderer.invoke(IPC_CHANNELS.sttTranscribe, request) as Promise<SttTranscribeResult>,
  search: (request) => ipcRenderer.invoke(IPC_CHANNELS.searchQuery, request) as Promise<SearchQueryResult>,
  onTerminalData: (listener) => subscribe<TerminalDataEvent>(IPC_EVENTS.terminalData, listener),
  onTerminalExit: (listener) => subscribe<TerminalExitEvent>(IPC_EVENTS.terminalExit, listener),
  onRoleChanged: (listener) => subscribe<RoleChangedEvent>(IPC_EVENTS.roleChanged, listener),
  onSyncStatus: (listener) => subscribe<SyncStatusEvent>(IPC_EVENTS.syncStatus, listener),
  onSearchRefreshed: (listener) => subscribe<SearchRefreshedEvent>(IPC_EVENTS.searchRefreshed, listener),
};

contextBridge.exposeInMainWorld('smartTerminal', api);

/**
 * TEST SEAM: `__testInvoke` exists only when the main process started the window with
 * `--smart-terminal-test-ipc` (SMART_TERMINAL_SMOKE=1 o SMART_TERMINAL_PTY_SMOKE=1). Allows testing rejection of
 * unknown channels/invalid payloads. No generic invoke is exposed in production.
 */
if (process.argv.includes(TEST_IPC_ARGUMENT)) {
  contextBridge.exposeInMainWorld('__testInvoke', (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),
  );
}
