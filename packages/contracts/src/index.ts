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
  terminalDetectEnvironment: 'terminal:detect-environment',
  historyRecord: 'history:record',
  clipboardConfigure: 'clipboard:configure',
  clipboardSetActive: 'clipboard:set-active',
  clipboardClear: 'clipboard:clear',
  clipboardState: 'clipboard:state',
  clipboardWrite: 'clipboard:write',
  searchQuery: 'search:query',
  searchFacets: 'search:facets',
  searchRemove: 'search:remove',
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
  aiCompose: 'ai:compose',
  aiAction: 'ai:action',
  aiActionsList: 'ai:actions:list',
  aiActionsSave: 'ai:actions:save',
  aiActionsReset: 'ai:actions:reset',
  aiActionsDelete: 'ai:actions:delete',
  aiCorrect: 'ai:correct',
  sttStatus: 'stt:status',
  sttModels: 'stt:models',
  sttTranscribe: 'stt:transcribe',
  sttSaveDebugAudio: 'stt:save-debug-audio',
} as const;

/** Main -> renderer events (not invocable from the renderer). */
export const IPC_EVENTS = {
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit',
  terminalEnvironment: 'terminal:environment',
  roleChanged: 'app:role-changed',
  syncStatus: 'sync:status',
  searchRefreshed: 'search:refreshed',
  windowMaximized: 'window:maximized',
} as const;

/** Maximum terminal input size in bytes per write. */
export const TERMINAL_MAX_WRITE_BYTES = 64 * 1024;
/** Maximum history text size in bytes. */
export const HISTORY_MAX_TEXT_BYTES = 16 * 1024;
/** Maximum agent identifier length in characters. */
export const HISTORY_MAX_AGENT_LENGTH = 64;
/** Maximum search query length in characters. */
export const SEARCH_MAX_QUERY_LENGTH = 256;
/** Maximum clipboard text size in bytes per write. */
export const CLIPBOARD_WRITE_MAX_BYTES = 32 * 1024;
/** Maximum text size in bytes submitted for AI correction. */
export const AI_CORRECTION_MAX_TEXT_BYTES = 16 * 1024;
/** Maximum audio sent to the main process for a single transcription (10 MiB). */
export const STT_MAX_AUDIO_BYTES = 10 * 1024 * 1024;
/** Minimum terminal row or column count. */
export const TERMINAL_MIN_DIMENSION = 1;
/** Maximum terminal row or column count. */
export const TERMINAL_MAX_DIMENSION = 1000;

/** Union of request channel names. */
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

/** Operating system detected for a session's shell. */
export type SessionOs = 'linux' | 'macos' | 'windows' | 'unknown';
/** Login shell detected for a session. */
export type SessionShell = 'bash' | 'zsh' | 'fish' | 'sh' | 'pwsh' | 'powershell' | 'cmd' | 'unknown';

/** OS/shell context persisted with the session (`session.md`) and used by AI actions. */
export interface SessionEnvironment {
  os: SessionOs;
  shell: SessionShell;
  /** How the values were obtained: local resolution, SSH probe, or not detected. */
  source: 'local' | 'ssh-probe' | 'unknown';
  /** ISO 8601; absent when nothing was detected. */
  detectedAt?: string;
}

export interface TerminalEnvironmentEvent {
  sessionId: string;
  environment: SessionEnvironment;
}

/** Re-runs environment detection for an existing session (the modal's "Detect again"). */
export interface TerminalDetectEnvironmentRequest {
  sessionId: string;
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
  /** Detected OS/shell context; absent until detected (for example, pending SSH probe). */
  environment?: SessionEnvironment;
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
  /** Stable event id inside the session's history.md/clipboard.md. */
  id: string;
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

/** Deletes one history/clipboard event from its Markdown file. */
export interface SearchRemoveRequest {
  kind: 'history' | 'clipboard';
  /** Session directory of the result entry: `sessions/<machine>/<dir>`. */
  sessionDirectory: string;
  /** Event id (`SearchResultEntry.id`). */
  id: string;
}

export interface SearchRemoveResult {
  /** False when the event was already gone; the caller may just refresh. */
  removed: boolean;
}

/** Text to copy to the system clipboard (Copy button). */
export interface ClipboardWriteRequest {
  text: string;
}

/** Available terminal font choices and their CSS fallback stacks. */
export const TERMINAL_FONTS = [
  { id: 'jetbrains', label: 'JetBrains Mono', stack: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'DejaVu Sans Mono', 'Liberation Mono', Menlo, Consolas, monospace" },
  { id: 'cascadia', label: 'Cascadia Code', stack: "'Cascadia Code', 'JetBrains Mono', 'DejaVu Sans Mono', 'Liberation Mono', Menlo, Consolas, monospace" },
  { id: 'fira', label: 'Fira Code', stack: "'Fira Code', 'JetBrains Mono', 'DejaVu Sans Mono', 'Liberation Mono', Menlo, Consolas, monospace" },
  { id: 'source-code-pro', label: 'Source Code Pro', stack: "'Source Code Pro', 'JetBrains Mono', 'DejaVu Sans Mono', 'Liberation Mono', Menlo, Consolas, monospace" },
  { id: 'ubuntu-mono', label: 'Ubuntu Mono', stack: "'Ubuntu Mono', 'JetBrains Mono', 'DejaVu Sans Mono', 'Liberation Mono', Menlo, Consolas, monospace" },
  { id: 'system', label: 'System monospace', stack: "'DejaVu Sans Mono', 'Liberation Mono', Menlo, Consolas, monospace" },
] as const;
export const TERMINAL_FONT_IDS = TERMINAL_FONTS.map(({ id }) => id);
export type TerminalFontId = (typeof TERMINAL_FONT_IDS)[number];

export const AI_PROVIDERS = ['none', 'anthropic', 'openai', 'openai-compatible'] as const;
export const STT_PROVIDERS = ['none', 'local', 'cloud'] as const;
export const STT_RESPONSE_FORMATS = ['json', 'verbose_json'] as const;
export type SttResponseFormat = (typeof STT_RESPONSE_FORMATS)[number];
export type AiProvider = (typeof AI_PROVIDERS)[number];
export type SttProvider = (typeof STT_PROVIDERS)[number];
/** Maximum secret token length in characters. */
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

/** Topics available in the in-app help. */
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

/** Maximum editable AI prompt size in bytes. */
export const AI_ACTION_MAX_PROMPT_BYTES = 16 * 1024;
/** Maximum size of one System/User template. */
export const AI_TEMPLATE_MAX_BYTES = 8 * 1024;
/** Maximum rendered System + User prompt size. */
export const AI_RENDERED_PROMPT_MAX_BYTES = 32 * 1024;
/** Maximum total actions (built-in + custom). */
export const AI_ACTIONS_MAX = 20;
export const AI_ACTION_TITLE_MAX = 60;
export const AI_ACTION_DESCRIPTION_MAX = 200;

/** Placeholders available in System/User templates. Unknown placeholders stay literal. */
export const AI_PLACEHOLDERS = ['os', 'shell', 'envSource', 'terminalInfo', 'console', 'composer', 'action', 'intent', 'description'] as const;
export type AiPlaceholder = (typeof AI_PLACEHOLDERS)[number];

/** One AI action: built-in ids have fixed title/description; templates are editable. */
export interface AiActionDefinition {
  id: string;
  title: string;
  description: string;
  systemTemplate: string;
  userTemplate: string;
  builtIn: boolean;
}

export interface AiActionsState {
  actions: AiActionDefinition[];
  placeholders: readonly AiPlaceholder[];
  /** Sanitized warning when the stored file was invalid and defaults were loaded. */
  warning?: string;
}

export interface AiActionsSaveRequest {
  action: AiActionDefinition;
}

export interface AiActionsResetRequest {
  id: string;
}

export interface AiActionsDeleteRequest {
  id: string;
}

/** The five assistant actions offered by the AI modal. */
export const AI_ACTION_IDS = ['suggest-command', 'explain-command', 'assess-risk', 'fix-message', 'rewrite-dictated'] as const;
export type AiActionId = (typeof AI_ACTION_IDS)[number];

/** OS/shell context sent with a prompt (derived from the persisted session environment). */
export interface AiEnvironment {
  os: SessionOs;
  shell: SessionShell;
  source?: SessionEnvironment['source'];
}

export interface AiComposeRequest {
  actionId: string;
  composerText: string;
  /** Visible terminal output for {{console}} (already bounded by the renderer). */
  consoleText?: string;
  /** `label · kind · os · shell` context prepared by the renderer for {{terminalInfo}}. */
  terminalInfo?: string;
  environment?: AiEnvironment;
}

export interface AiComposeResult { system: string; user: string; }

export interface AiActionRequest { actionId: string; system: string; user: string; }

/** Why an action produced no usable text. */
export type AiActionSkipReason = CorrectionReason | 'sensitive';

export interface AiActionResult {
  text: string;
  skipped: boolean;
  reason?: AiActionSkipReason;
  /** Sanitized diagnostic: category/HTTP status only, never a provider body or token. */
  error?: string;
  elapsedMs: number;
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

/** Reason an AI correction was skipped or failed. */
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
  durationMs?: number;
}

export interface SttDiagnostics {
  stage: 'success' | 'config' | 'network' | 'http' | 'json' | 'empty' | 'timeout' | 'unsupported' | 'test';
  serviceReached: boolean;
  httpStatus?: number;
  contentType?: string;
  jsonValid?: boolean;
  elapsedMs?: number;
  endpoint?: string;
  provider?: SttProvider;
  model?: string;
  language?: string;
  audioBytes?: number;
  mimeType?: string;
  durationMs?: number;
  textLength?: number;
  error?: string;
  providerMessage?: string;
}

export interface SttModelInfo {
  id: string;
  label?: string;
  loaded?: boolean;
}

export interface SttSaveDebugAudioRequest {
  audio: Uint8Array;
  mimeType: string;
  durationMs?: number;
}

export interface SttSaveDebugAudioResult {
  path: string;
  bytes: number;
}

/** Reason speech transcription was skipped. */
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
  diagnostics?: SttDiagnostics;
}

/** Function that removes a registered event listener. */
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
  /** Removes one history/clipboard entry; the Markdown file is rewritten atomically. */
  searchRemove(request: SearchRemoveRequest): Promise<SearchRemoveResult>;
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
  /** Renders the editable prompt body for an action (no network). */
  aiCompose(request: AiComposeRequest): Promise<AiComposeResult>;
  /** Runs one action; the system instruction and provider call stay in main. */
  aiAction(request: AiActionRequest): Promise<AiActionResult>;
  /** Stored action templates and placeholders (built-in defaults when nothing was customized). */
  aiActionsList(): Promise<AiActionsState>;
  /** Upserts one action; built-in titles/descriptions stay fixed. */
  aiActionsSave(request: AiActionsSaveRequest): Promise<AiActionsState>;
  /** Restores one built-in action to its default templates. */
  aiActionsReset(request: AiActionsResetRequest): Promise<AiActionsState>;
  /** Deletes a custom action. */
  aiActionsDelete(request: AiActionsDeleteRequest): Promise<AiActionsState>;
  sttStatus(): Promise<SttStatus>;
  sttModels(): Promise<SttModelInfo[]>;
  sttTranscribe(request: SttTranscribeRequest): Promise<SttTranscribeResult>;
  sttSaveDebugAudio(request: SttSaveDebugAudioRequest): Promise<SttSaveDebugAudioResult>;
  onTerminalData(listener: (event: TerminalDataEvent) => void): Unsubscribe;
  onTerminalExit(listener: (event: TerminalExitEvent) => void): Unsubscribe;
  /** Late environment detection (for example, the SSH probe) for an existing session. */
  onTerminalEnvironment(listener: (event: TerminalEnvironmentEvent) => void): Unsubscribe;
  /** Re-runs detection for one session; local sessions return immediately, SSH re-probes. */
  detectSessionEnvironment(request: TerminalDetectEnvironmentRequest): Promise<SessionEnvironment>;
  onRoleChanged(listener: (event: RoleChangedEvent) => void): Unsubscribe;
  onSyncStatus(listener: (event: SyncStatusEvent) => void): Unsubscribe;
  onSearchRefreshed(listener: (event: SearchRefreshedEvent) => void): Unsubscribe;
}

/** Launch argument enabling the `__testInvoke` test seam in preload. */
export const TEST_IPC_ARGUMENT = '--smart-terminal-test-ipc';
