/**
 * Shared contracts between main, preload and renderer.
 * Every IPC channel must be listed here and validated in the main process.
 */
export const IPC_CHANNELS = {
  appPing: 'app:ping',
  appRuntimeInfo: 'app:runtime-info',
  terminalCreate: 'terminal:create',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalClose: 'terminal:close',
  terminalList: 'terminal:list',
  historyRecord: 'history:record',
  clipboardConfigure: 'clipboard:configure',
  clipboardSetActive: 'clipboard:set-active',
  clipboardClear: 'clipboard:clear',
  clipboardState: 'clipboard:state',
  clipboardWrite: 'clipboard:write',
  searchQuery: 'search:query',
  searchFacets: 'search:facets',
  syncStatus: 'sync:get-status',
  sshAliases: 'ssh:aliases',
  onboardingState: 'onboarding:state',
  onboardingValidate: 'onboarding:validate',
  onboardingSave: 'onboarding:save',
  onboardingSkip: 'onboarding:skip',
  setupTestRemote: 'setup:test-remote',
  setupTestAi: 'setup:test-ai',
  helpOpen: 'help:open',
  secretsStatus: 'secrets:status',
  secretsLogout: 'secrets:logout',
  appRelaunch: 'app:relaunch',
  windowControl: 'window:control',
  aiStatus: 'ai:status',
  aiCorrect: 'ai:correct',
  sttStatus: 'stt:status',
  sttTranscribe: 'stt:transcribe',
} as const;

/** Main -> renderer events (not invocable from the renderer). */
export const IPC_EVENTS = {
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit',
  roleChanged: 'app:role-changed',
  syncStatus: 'sync:status',
  searchRefreshed: 'search:refreshed',
  windowMaximized: 'window:maximized',
} as const;

export const TERMINAL_MAX_WRITE_BYTES = 64 * 1024;
export const HISTORY_MAX_TEXT_BYTES = 16 * 1024;
export const HISTORY_MAX_AGENT_LENGTH = 64;
export const SEARCH_MAX_QUERY_LENGTH = 256;
export const CLIPBOARD_WRITE_MAX_BYTES = 32 * 1024;
export const AI_CORRECTION_MAX_TEXT_BYTES = 16 * 1024;
/** Maximum audio sent to the main process for a single transcription (10 MiB). */
export const STT_MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const TERMINAL_MIN_DIMENSION = 1;
export const TERMINAL_MAX_DIMENSION = 1000;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export interface AppPingResult {
  appVersion: string;
  platform: string;
}

export interface AppRuntimeInfo {
  appVersion: string;
  platform: string;
  isPackaged: boolean;
  /** This instance is the coordinator primary for the machine. */
  isPrimary: boolean;
}

/** Sync state published by the primary to windows (`sync:status` event). */
export interface SyncStatusEvent {
  state: 'synced' | 'dirty' | 'syncing' | 'offline' | 'error';
  lastSyncAt?: string;
  lastError?: string;
  remoteConfigured: boolean;
}

/** The primary reloaded the search index after a Git pull. */
export interface SearchRefreshedEvent {
  refreshedAt: string;
}

export type WindowControlAction = 'minimize' | 'toggle-maximize' | 'close';
export interface WindowMaximizedEvent { maximized: boolean; }

export interface RoleChangedEvent {
  isPrimary: boolean;
}

/** `local`: `sshAlias` assente. `ssh`: `sshAlias` obbligatorio e `cwd` non ammesso. */
export interface TerminalCreateRequest {
  kind: 'local' | 'ssh';
  sshAlias?: string;
  cwd?: string;
  cols?: number;
  rows?: number;
}

export interface TerminalSessionInfo {
  /** Matches `label` (`S<n>`, per-machine sequence). */
  sessionId: string;
  label: string;
  kind: 'local' | 'ssh';
  /** Alias SSH oppure `local`. */
  target: string;
  pid: number;
  cwd: string;
  machine: string;
  /** Session directory relative to the data repository: `sessions/<machine>/<dir>`. */
  sessionDirectory: string;
  /** ISO 8601 with offset. */
  startedAt: string;
}

export interface TerminalWriteRequest {
  sessionId: string;
  data: string;
}

export interface TerminalResizeRequest {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface TerminalCloseRequest {
  sessionId: string;
}

export interface TerminalDataEvent {
  sessionId: string;
  data: string;
}

export interface TerminalExitEvent {
  sessionId: string;
  exitCode: number;
  signal?: number;
}

/** Explicit submission from the assisted editor; the source is always `assisted` and set by the main process. */
export interface HistoryRecordRequest {
  sessionId: string;
  text: string;
  agent?: string;
}

export interface HistoryRecordResult {
  recorded: boolean;
}

export interface ClipboardConfigureRequest {
  enabled: boolean;
  paused: boolean;
}

/** `null` when there is no active session. */
export interface ClipboardSetActiveRequest {
  sessionId: string | null;
}

export interface ClipboardCaptureState {
  enabled: boolean;
  paused: boolean;
  /** ISO 8601 of the last clipboard event written in this process. */
  lastEventAt: string | null;
}

export type SearchEntryKind = 'history' | 'clipboard';

export interface SearchQueryRequest {
  /** Case-insensitive substring (may be empty to apply filters only). */
  query: string;
  machine?: string;
  sessionId?: string;
  /** ISO 8601 with offset, inclusive. */
  from?: string;
  /** ISO 8601 with offset, inclusive. */
  to?: string;
  kind?: SearchEntryKind;
}

export interface SearchResultEntry {
  machine: string;
  sessionId: string;
  sessionDirectory: string;
  kind: SearchEntryKind;
  timestamp: string;
  text: string;
  source?: string;
  cwd?: string;
}

/** At most 100 entries, sorted by descending timestamp. */
export interface SearchQueryResult {
  entries: SearchResultEntry[];
}

export interface SearchFacetsResult {
  /** Macchine presenti nell'indice, in ordine alfabetico. */
  machines: string[];
}

/** Text to copy to the system clipboard (Copy button). */
export interface ClipboardWriteRequest {
  text: string;
}

export const TERMINAL_FONTS = [
  { id: 'jetbrains', label: 'JetBrains Mono', stack: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace" },
  { id: 'cascadia', label: 'Cascadia Code', stack: "'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace" },
  { id: 'fira', label: 'Fira Code', stack: "'Fira Code', 'JetBrains Mono', ui-monospace, monospace" },
  { id: 'source-code-pro', label: 'Source Code Pro', stack: "'Source Code Pro', 'JetBrains Mono', ui-monospace, monospace" },
  { id: 'ubuntu-mono', label: 'Ubuntu Mono', stack: "'Ubuntu Mono', 'JetBrains Mono', ui-monospace, monospace" },
  { id: 'system', label: 'System monospace', stack: 'ui-monospace, monospace' },
] as const;
export const TERMINAL_FONT_IDS = TERMINAL_FONTS.map(({ id }) => id);
export type TerminalFontId = (typeof TERMINAL_FONT_IDS)[number];

export const AI_PROVIDERS = ['none', 'anthropic', 'openai', 'openai-compatible'] as const;
export const STT_PROVIDERS = ['none', 'local', 'cloud'] as const;
export const STT_RESPONSE_FORMATS = ['json', 'verbose_json'] as const;
export type SttResponseFormat = (typeof STT_RESPONSE_FORMATS)[number];
export type AiProvider = (typeof AI_PROVIDERS)[number];
export type SttProvider = (typeof STT_PROVIDERS)[number];
export const SECRET_TOKEN_MAX_LENGTH = 4096;

/** Configuration fields editable by the wizard (no secrets). */
export interface OnboardingConfig {
  terminalFont?: TerminalFontId;
  machineName: string;
  dataRepoPath: string;
  dataRepoRemote?: string;
  aiProvider: AiProvider;
  aiBaseUrl?: string;
  aiModel?: string;
  sttProvider: SttProvider;
  sttUseAiProvider?: boolean;
  sttModel?: string;
  sttBaseUrl?: string;
  sttResponseFormat?: SttResponseFormat;
  sttLanguage?: string;
  /** Absolute path to the local STT executable (`local` provider). */
  sttCommand?: string;
}

export interface OnboardingState {
  /** Whether the wizard must be shown. */
  required: boolean;
  /** `env-override`: percorsi forzati da variabili d'ambiente (test), nessun wizard. */
  reason: 'missing' | 'corrupt' | 'valid' | 'env-override';
  /** Valori correnti (config valida) oppure predefiniti. */
  config: OnboardingConfig;
  /** Whether system secure encryption (keychain) is available. */
  secureStorage: boolean;
  /** Present secret keys (`ai:<provider>`, `stt:<provider>`); never the tokens. */
  storedSecrets: string[];
}

/** Optional tokens: they stay in the main process and never return to the renderer. */
export interface OnboardingSaveRequest {
  config: OnboardingConfig;
  aiToken?: string;
  sttToken?: string;
}

export interface OnboardingValidateRequest {
  config: OnboardingConfig;
}

export const HELP_TOPICS = ['repository', 'ai', 'stt', 'troubleshooting'] as const;
export type HelpTopic = (typeof HELP_TOPICS)[number];

export interface SetupTestAiRequest {
  config: OnboardingConfig;
  /** Token currently entered in the wizard; if omitted, the stored token is used. */
  aiToken?: string;
}

export interface SetupTestAiResult {
  ok: boolean;
  provider: AiProvider;
  model?: string;
  latencyMs?: number;
  response?: string;
  error?: string;
}

export interface RemoteSetupResult {
  ok: boolean;
  /** The instance registration was committed locally. */
  committed: boolean;
  /** The commit reached the configured remote. */
  pushed: boolean;
  /** No remote configured: local commit only. */
  localOnly: boolean;
  state: 'synced' | 'offline' | 'error';
  commit?: string;
  path?: string;
  error?: string;
}

export interface OnboardingValidationResult {
  ok: boolean;
  /** Field (`machineName`, `dataRepoPath`, ...) -> fixed, sanitized message. */
  errors: Record<string, string>;
}

export interface OnboardingSaveResult extends OnboardingValidationResult {
  /** Data repository, machine or remote changed: the app must restart to apply them. */
  restartRequired: boolean;
  warnings: string[];
}

export interface SecretsStatus {
  secureStorage: boolean;
  storedSecrets: string[];
}

export interface SecretsLogoutRequest {
  key: string;
}

export interface AiStatus {
  configured: boolean;
  provider: AiProvider;
  model?: string;
  hasToken: boolean;
  secureStorage: boolean;
  warning?: string;
}

export interface AiCorrectRequest {
  text: string;
}

export type CorrectionReason = 'shell' | 'unconfigured' | 'missing-token' | 'timeout' | 'provider-error' | 'empty';

export interface CorrectionResult {
  original: string;
  corrected: string;
  changed: boolean;
  skipped: boolean;
  reason?: CorrectionReason;
  error?: string;
}

export interface SttStatus {
  configured: boolean;
  provider: SttProvider;
  model?: string;
  /** `stt:cloud` token present in the keychain. */
  hasToken: boolean;
  secureStorage: boolean;
  warning?: string;
}

/** Audio recorded in the renderer, never saved to disk by either side. */
export interface SttTranscribeRequest {
  audio: Uint8Array;
  mimeType: string;
}

export type SttSkipReason =
  | 'unconfigured'
  | 'missing-token'
  | 'invalid-audio'
  | 'timeout'
  | 'provider-error'
  | 'empty'
  | 'unsupported';

export interface SttTranscribeResult {
  text: string;
  skipped: boolean;
  reason?: SttSkipReason;
}

export type Unsubscribe = () => void;

export interface SmartTerminalApi {
  ping(): Promise<AppPingResult>;
  runtimeInfo(): Promise<AppRuntimeInfo>;
  createTerminal(request: TerminalCreateRequest): Promise<TerminalSessionInfo>;
  writeTerminal(request: TerminalWriteRequest): Promise<void>;
  resizeTerminal(request: TerminalResizeRequest): Promise<void>;
  closeTerminal(request: TerminalCloseRequest): Promise<void>;
  listTerminals(): Promise<TerminalSessionInfo[]>;
  recordHistory(request: HistoryRecordRequest): Promise<HistoryRecordResult>;
  clipboardState(): Promise<ClipboardCaptureState>;
  clipboardConfigure(request: ClipboardConfigureRequest): Promise<ClipboardCaptureState>;
  clipboardSetActive(request: ClipboardSetActiveRequest): Promise<ClipboardCaptureState>;
  /** Clears the in-memory dedupe (hashes already written to clipboard.md remain deduplicated). */
  clipboardClear(): Promise<ClipboardCaptureState>;
  clipboardWrite(request: ClipboardWriteRequest): Promise<void>;
  search(request: SearchQueryRequest): Promise<SearchQueryResult>;
  searchFacets(): Promise<SearchFacetsResult>;
  /** Current sync state: from the local primary or via RPC when this instance is secondary. */
  syncStatus(): Promise<SyncStatusEvent>;
  /** Alias `Host` da `~/.ssh/config` (read-only). */
  sshAliases(): Promise<string[]>;
  onboardingState(): Promise<OnboardingState>;
  onboardingValidate(request: OnboardingValidateRequest): Promise<OnboardingValidationResult>;
  onboardingSave(request: OnboardingSaveRequest): Promise<OnboardingSaveResult>;
  /** Skips the wizard by saving a configuration with default values. */
  onboardingSkip(): Promise<OnboardingSaveResult>;
  setupTestRemote(config: OnboardingConfig): Promise<RemoteSetupResult>;
  setupTestAi(request: SetupTestAiRequest): Promise<SetupTestAiResult>;
  helpOpen(topic: HelpTopic): Promise<void>;
  secretsStatus(): Promise<SecretsStatus>;
  /** Revokes (deletes) the token for the key. */
  secretsLogout(request: SecretsLogoutRequest): Promise<SecretsStatus>;
  /** Riavvia l'app (relaunch + exit). */
  appRelaunch(): Promise<void>;
  windowControl(action: WindowControlAction): Promise<void>;
  onWindowMaximized(listener: (event: WindowMaximizedEvent) => void): Unsubscribe;
  aiStatus(): Promise<AiStatus>;
  aiCorrect(request: AiCorrectRequest): Promise<CorrectionResult>;
  sttStatus(): Promise<SttStatus>;
  sttTranscribe(request: SttTranscribeRequest): Promise<SttTranscribeResult>;
  onTerminalData(listener: (event: TerminalDataEvent) => void): Unsubscribe;
  onTerminalExit(listener: (event: TerminalExitEvent) => void): Unsubscribe;
  onRoleChanged(listener: (event: RoleChangedEvent) => void): Unsubscribe;
  onSyncStatus(listener: (event: SyncStatusEvent) => void): Unsubscribe;
  onSearchRefreshed(listener: (event: SearchRefreshedEvent) => void): Unsubscribe;
}

/** Launch argument enabling the `__testInvoke` test seam in preload. */
export const TEST_IPC_ARGUMENT = '--smart-terminal-test-ipc';
