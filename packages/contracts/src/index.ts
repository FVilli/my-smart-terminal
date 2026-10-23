/**
 * Contratti condivisi tra main, preload e renderer.
 * Ogni canale IPC deve essere elencato qui e validato nel main.
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
  secretsStatus: 'secrets:status',
  secretsLogout: 'secrets:logout',
  appRelaunch: 'app:relaunch',
  aiStatus: 'ai:status',
  aiCorrect: 'ai:correct',
} as const;

/** Eventi main -> renderer (non invocabili dal renderer). */
export const IPC_EVENTS = {
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit',
  roleChanged: 'app:role-changed',
  syncStatus: 'sync:status',
  searchRefreshed: 'search:refreshed',
} as const;

export const TERMINAL_MAX_WRITE_BYTES = 64 * 1024;
export const HISTORY_MAX_TEXT_BYTES = 16 * 1024;
export const HISTORY_MAX_AGENT_LENGTH = 64;
export const SEARCH_MAX_QUERY_LENGTH = 256;
export const CLIPBOARD_WRITE_MAX_BYTES = 32 * 1024;
export const AI_CORRECTION_MAX_TEXT_BYTES = 16 * 1024;
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
  /** Questa istanza e' il coordinator primary della macchina. */
  isPrimary: boolean;
}

/** Stato sync pubblicato dal primary alle finestre (evento `sync:status`). */
export interface SyncStatusEvent {
  state: 'synced' | 'dirty' | 'syncing' | 'offline' | 'error';
  lastSyncAt?: string;
  lastError?: string;
  remoteConfigured: boolean;
}

/** Il primary ha riletto l'indice di ricerca dopo un pull Git. */
export interface SearchRefreshedEvent {
  refreshedAt: string;
}

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
  /** Coincide con `label` (`S<n>`, progressivo per macchina). */
  sessionId: string;
  label: string;
  kind: 'local' | 'ssh';
  /** Alias SSH oppure `local`. */
  target: string;
  pid: number;
  cwd: string;
  machine: string;
  /** Directory sessione relativa al repo dati: `sessions/<machine>/<dir>`. */
  sessionDirectory: string;
  /** ISO 8601 con offset. */
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

/** Invio esplicito dall'editor assistito; la source è sempre `assisted` e viene fissata dal main. */
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

/** `null` quando non esiste una sessione attiva. */
export interface ClipboardSetActiveRequest {
  sessionId: string | null;
}

export interface ClipboardCaptureState {
  enabled: boolean;
  paused: boolean;
  /** ISO 8601 dell'ultimo evento clipboard scritto in questo processo. */
  lastEventAt: string | null;
}

export type SearchEntryKind = 'history' | 'clipboard';

export interface SearchQueryRequest {
  /** Sottostringa case-insensitive (anche vuota, per filtrare solo). */
  query: string;
  machine?: string;
  sessionId?: string;
  /** ISO 8601 con offset, inclusivo. */
  from?: string;
  /** ISO 8601 con offset, inclusivo. */
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

/** Al massimo 100 voci, ordinate per timestamp decrescente. */
export interface SearchQueryResult {
  entries: SearchResultEntry[];
}

export interface SearchFacetsResult {
  /** Macchine presenti nell'indice, in ordine alfabetico. */
  machines: string[];
}

/** Testo da copiare nella clipboard di sistema (pulsante Copia). */
export interface ClipboardWriteRequest {
  text: string;
}

export const AI_PROVIDERS = ['none', 'anthropic', 'openai', 'openai-compatible'] as const;
export const STT_PROVIDERS = ['none', 'local', 'cloud'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];
export type SttProvider = (typeof STT_PROVIDERS)[number];
export const SECRET_TOKEN_MAX_LENGTH = 4096;

/** Parte della configurazione modificabile dal wizard (nessun segreto). */
export interface OnboardingConfig {
  machineName: string;
  dataRepoPath: string;
  dataRepoRemote?: string;
  aiProvider: AiProvider;
  aiBaseUrl?: string;
  aiModel?: string;
  sttProvider: SttProvider;
  sttModel?: string;
}

export interface OnboardingState {
  /** Il wizard deve essere mostrato. */
  required: boolean;
  /** `env-override`: percorsi forzati da variabili d'ambiente (test), nessun wizard. */
  reason: 'missing' | 'corrupt' | 'valid' | 'env-override';
  /** Valori correnti (config valida) oppure predefiniti. */
  config: OnboardingConfig;
  /** La cifratura sicura del sistema (keychain) e' disponibile. */
  secureStorage: boolean;
  /** Chiavi segreto presenti (`ai:<provider>`, `stt:<provider>`); mai i token. */
  storedSecrets: string[];
}

/** Token opzionali: restano nel main e non tornano mai al renderer. */
export interface OnboardingSaveRequest {
  config: OnboardingConfig;
  aiToken?: string;
  sttToken?: string;
}

export interface OnboardingValidateRequest {
  config: OnboardingConfig;
}

export interface OnboardingValidationResult {
  ok: boolean;
  /** Campo (`machineName`, `dataRepoPath`, ...) -> messaggio fisso e sanificato. */
  errors: Record<string, string>;
}

export interface OnboardingSaveResult extends OnboardingValidationResult {
  /** Repo dati, machine o remote cambiati: serve riavviare l'app per applicarli. */
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
  /** Azzera il dedupe in memoria (gli hash gia' scritti in clipboard.md restano dedupati). */
  clipboardClear(): Promise<ClipboardCaptureState>;
  clipboardWrite(request: ClipboardWriteRequest): Promise<void>;
  search(request: SearchQueryRequest): Promise<SearchQueryResult>;
  searchFacets(): Promise<SearchFacetsResult>;
  /** Stato sync corrente: dal primary locale oppure via RPC se questa istanza e' secondary. */
  syncStatus(): Promise<SyncStatusEvent>;
  /** Alias `Host` da `~/.ssh/config` (sola lettura). */
  sshAliases(): Promise<string[]>;
  onboardingState(): Promise<OnboardingState>;
  onboardingValidate(request: OnboardingValidateRequest): Promise<OnboardingValidationResult>;
  onboardingSave(request: OnboardingSaveRequest): Promise<OnboardingSaveResult>;
  /** Salta il wizard salvando una configurazione con valori predefiniti. */
  onboardingSkip(): Promise<OnboardingSaveResult>;
  secretsStatus(): Promise<SecretsStatus>;
  /** Revoca (cancella) il token della chiave. */
  secretsLogout(request: SecretsLogoutRequest): Promise<SecretsStatus>;
  /** Riavvia l'app (relaunch + exit). */
  appRelaunch(): Promise<void>;
  aiStatus(): Promise<AiStatus>;
  aiCorrect(request: AiCorrectRequest): Promise<CorrectionResult>;
  onTerminalData(listener: (event: TerminalDataEvent) => void): Unsubscribe;
  onTerminalExit(listener: (event: TerminalExitEvent) => void): Unsubscribe;
  onRoleChanged(listener: (event: RoleChangedEvent) => void): Unsubscribe;
  onSyncStatus(listener: (event: SyncStatusEvent) => void): Unsubscribe;
  onSearchRefreshed(listener: (event: SearchRefreshedEvent) => void): Unsubscribe;
}

/** Argomento di avvio che abilita il seam di test `__testInvoke` nel preload. */
export const TEST_IPC_ARGUMENT = '--smart-terminal-test-ipc';
