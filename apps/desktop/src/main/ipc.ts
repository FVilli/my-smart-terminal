/**
 * Pure framework (without Electron dependencies) for validated IPC handlers.
 * The ipcMain binding lives in ipc-electron.ts.
 */
import { isIsoTimestamp, isValidMachine } from '@smart-terminal/data';
import {
  AI_ACTION_DESCRIPTION_MAX,
  AI_ACTION_TITLE_MAX,
  AI_ACTION_MAX_PROMPT_BYTES,
  AI_RENDERED_PROMPT_MAX_BYTES,
  AI_TEMPLATE_MAX_BYTES,
  AI_CORRECTION_MAX_TEXT_BYTES,
  CLIPBOARD_WRITE_MAX_BYTES,
  HISTORY_MAX_AGENT_LENGTH,
  HISTORY_MAX_TEXT_BYTES,
  IPC_CHANNELS,
  SEARCH_MAX_QUERY_LENGTH,
  STT_MAX_AUDIO_BYTES,
  TERMINAL_MAX_DIMENSION,
  TERMINAL_MAX_WRITE_BYTES,
  TERMINAL_MIN_DIMENSION,
  type AppPingResult,
  type AiActionDefinition,
  type AiActionRequest,
  type AiActionsDeleteRequest,
  type AiActionsResetRequest,
  type AiActionsSaveRequest,
  type AiActionsState,
  type AiComposeRequest,
  type AiComposeResult,
  type AiActionResult,
  type AiCorrectRequest,
  type AiStatus,
  type AiModelInfo,
  type AiModelsRequest,
  type AppRuntimeInfo,
  type ClipboardCaptureState,
  type ClipboardConfigureRequest,
  type ClipboardSetActiveRequest,
  type ClipboardWriteRequest,
  type CorrectionResult,
  type HistoryRecordRequest,
  type HistoryRecordResult,
  type IpcChannel,
  type OnboardingConfig,
  type OnboardingSaveRequest,
  type OnboardingSaveResult,
  type RemoteSetupResult,
  type OnboardingState,
  type OnboardingValidateRequest,
  type OnboardingValidationResult,
  type SecretsLogoutRequest,
  type SecretsStatus,
  type SearchFacetsResult,
  type SearchQueryRequest,
  type SearchRemoveRequest,
  type SessionEnvironment,
  type SearchRemoveResult,
  type SearchQueryResult,
  type HelpTopic,
  type HelpOpenResult,
  type SetupTestAiRequest,
  type SetupTestAiResult,
  type SttStatus,
  type SttModelInfo,
  type SttSaveDebugAudioRequest,
  type SttSaveDebugAudioResult,
  type SttTranscribeRequest,
  type SttTranscribeResult,
  type SyncStatusEvent,
  type TerminalCloseRequest,
  type TerminalDetectEnvironmentRequest,
  type TerminalCreateRequest,
  type TerminalResizeRequest,
  type TerminalSessionInfo,
  type TerminalWriteRequest,
  type WindowControlAction,
} from '@smart-terminal/contracts';
import { TerminalError, isValidSshAlias } from '@smart-terminal/terminal';
import { isAudioMimeType } from '@smart-terminal/ai';
import { validateOnboardingConfig } from './onboarding-service';

export const MAX_PAYLOAD_BYTES = 128 * 1024;

export class IpcError extends Error {
  constructor(readonly code: 'IPC_INVALID_SENDER' | 'IPC_INVALID_PAYLOAD' | 'IPC_PAYLOAD_TOO_LARGE' | 'IPC_INTERNAL') {
    super(code);
    this.name = 'IpcError';
  }
}

export interface SenderInfo {
  senderId: number;
  isMainFrame: boolean;
  frameUrl: string;
}

export interface SenderPolicy {
  expectedSenderIds: ReadonlySet<number>;
  devServerUrl: string | undefined;
  appOrigin: string; // es. smart-terminal://bundle/
}

export function isSenderAllowed(sender: SenderInfo, policy: SenderPolicy): boolean {
  if (!policy.expectedSenderIds.has(sender.senderId) || !sender.isMainFrame) {
    return false;
  }
  if (policy.devServerUrl) {
    try {
      return new URL(sender.frameUrl).origin === new URL(policy.devServerUrl).origin;
    } catch {
      return false;
    }
  }
  return sender.frameUrl.startsWith(policy.appOrigin);
}

export interface ChannelDefinition<Args extends unknown[], Result> {
  /** Validates raw arguments; must throw or return false when invalid. */
  validate(args: unknown[]): args is Args;
  handle(sender: SenderInfo, ...args: Args): Result | Promise<Result>;
  /** Serialized payload limit (default `MAX_PAYLOAD_BYTES`); STT audio uses a dedicated limit. */
  maxPayloadBytes?: number;
}

export interface RuntimeEnvironment {
  appVersion: string;
  platform: string;
  isPackaged: boolean;
  isPrimary(): boolean;
}

export const noArguments = (args: unknown[]): args is [] => args.length === 0;

/** Terminal operations associated with the requesting window (senderId). */
export interface TerminalGateway {
  create(senderId: number, request: TerminalCreateRequest): Promise<TerminalSessionInfo>;
  write(senderId: number, sessionId: string, data: string): void;
  resize(senderId: number, sessionId: string, cols: number, rows: number): void;
  close(senderId: number, sessionId: string): void;
  list(senderId: number): TerminalSessionInfo[];
  detectEnvironment(senderId: number, sessionId: string): Promise<SessionEnvironment>;
}

export interface HistoryGateway {
  record(senderId: number, request: HistoryRecordRequest): HistoryRecordResult;
}

export interface ClipboardGateway {
  state(): Promise<ClipboardCaptureState>;
  configure(request: ClipboardConfigureRequest): Promise<ClipboardCaptureState>;
  setActive(senderId: number, request: ClipboardSetActiveRequest): Promise<ClipboardCaptureState>;
  clear(): Promise<ClipboardCaptureState>;
}

export interface SearchGateway {
  query(request: SearchQueryRequest): SearchQueryResult | Promise<SearchQueryResult>;
  facets(): SearchFacetsResult | Promise<SearchFacetsResult>;
  remove(request: SearchRemoveRequest): SearchRemoveResult | Promise<SearchRemoveResult>;
}

export interface SyncGateway {
  status(): Promise<SyncStatusEvent>;
}

export interface AiActionsGateway {
  list(): AiActionsState | Promise<AiActionsState>;
  save(request: AiActionsSaveRequest): AiActionsState | Promise<AiActionsState>;
  reset(request: AiActionsResetRequest): AiActionsState | Promise<AiActionsState>;
  delete(request: AiActionsDeleteRequest): AiActionsState | Promise<AiActionsState>;
}

export interface AiGateway {
  status(): AiStatus | Promise<AiStatus>;
  models(request?: AiModelsRequest): AiModelInfo[] | Promise<AiModelInfo[]>;
  correct(request: AiCorrectRequest): CorrectionResult | Promise<CorrectionResult>;
  testConnection(request?: SetupTestAiRequest): SetupTestAiResult | Promise<SetupTestAiResult>;
  compose(request: AiComposeRequest): AiComposeResult | Promise<AiComposeResult>;
  action(request: AiActionRequest): AiActionResult | Promise<AiActionResult>;
}

export interface SttGateway {
  status(): SttStatus | Promise<SttStatus>;
  models(): SttModelInfo[] | Promise<SttModelInfo[]>;
  transcribe(request: SttTranscribeRequest): SttTranscribeResult | Promise<SttTranscribeResult>;
  saveDebugAudio(request: SttSaveDebugAudioRequest): SttSaveDebugAudioResult | Promise<SttSaveDebugAudioResult>;
}

/** Writes text to the system clipboard (Copy button). */
export interface ClipboardTextWriter {
  /** Electron 45 async clipboard: dispatch awaits the promise, so the writer may return one. */
  writeText(text: string): void | Promise<void>;
}

export interface SshGateway {
  aliases(): string[] | Promise<string[]>;
}

export interface OnboardingGateway {
  state(): OnboardingState;
  testRemote(config: OnboardingConfig): Promise<RemoteSetupResult>;
  validate(config: unknown): OnboardingValidationResult;
  save(request: OnboardingSaveRequest): OnboardingSaveResult;
  skip(): OnboardingSaveResult;
  secretsStatus(): SecretsStatus;
  logout(key: string): SecretsStatus;
}

/** Riavvio dell'app (`app.relaunch()` + `app.exit()`). */
export interface AppController {
  relaunch(): void;
}

export interface HelpGateway {
  open(topic: HelpTopic): Promise<HelpOpenResult>;
}

export interface WindowGateway {
  control(senderId: number, action: WindowControlAction): void;
}

export interface IpcServices {
  window: WindowGateway;
  help: HelpGateway;
  ssh: SshGateway;
  onboarding: OnboardingGateway;
  app: AppController;
  search: SearchGateway;
  history: HistoryGateway;
  clipboard: ClipboardGateway;
  sync: SyncGateway;
  clipboardWriter: ClipboardTextWriter;
  ai: AiGateway;
  aiActions: AiActionsGateway;
  stt: SttGateway;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function hasExactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key));
}

const isDimension = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= TERMINAL_MIN_DIMENSION &&
  value <= TERMINAL_MAX_DIMENSION;

const isSessionId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 128;

function singleRequest<T>(check: (value: Record<string, unknown>) => boolean) {
  return (args: unknown[]): args is [T] => args.length === 1 && isPlainRecord(args[0]) && check(args[0]);
}

const isSshAlias = (value: unknown): boolean => isValidSshAlias(value);

export const validateWindowControl = singleRequest<{ action: WindowControlAction }>((v) =>
  hasExactKeys(v, ['action']) && ['minimize', 'toggle-maximize', 'close'].includes(String(v['action'])),
);

export const validateTerminalCreate = singleRequest<TerminalCreateRequest>(
  (v) =>
    hasExactKeys(v, ['kind'], ['sshAlias', 'cwd', 'cols', 'rows']) &&
    (v['kind'] === 'local' ? v['sshAlias'] === undefined : v['kind'] === 'ssh' && v['cwd'] === undefined && isSshAlias(v['sshAlias'])) &&
    (v['cwd'] === undefined || (typeof v['cwd'] === 'string' && v['cwd'].length > 0 && v['cwd'].length <= 4096)) &&
    (v['cols'] === undefined || isDimension(v['cols'])) &&
    (v['rows'] === undefined || isDimension(v['rows'])),
);

export const validateTerminalWrite = singleRequest<TerminalWriteRequest>(
  (v) =>
    hasExactKeys(v, ['sessionId', 'data']) &&
    isSessionId(v['sessionId']) &&
    typeof v['data'] === 'string' &&
    Buffer.byteLength(v['data'], 'utf8') <= TERMINAL_MAX_WRITE_BYTES,
);

export const validateTerminalResize = singleRequest<TerminalResizeRequest>(
  (v) => hasExactKeys(v, ['sessionId', 'cols', 'rows']) && isSessionId(v['sessionId']) && isDimension(v['cols']) && isDimension(v['rows']),
);

export const validateTerminalClose = singleRequest<TerminalCloseRequest>(
  (v) => hasExactKeys(v, ['sessionId']) && isSessionId(v['sessionId']),
);

export const validateTerminalDetectEnvironment = singleRequest<TerminalDetectEnvironmentRequest>(
  (v) => hasExactKeys(v, ['sessionId']) && typeof v['sessionId'] === 'string' && v['sessionId'].length > 0 && v['sessionId'].length <= 64,
);

export const validateHistoryRecord = singleRequest<HistoryRecordRequest>(
  (v) =>
    hasExactKeys(v, ['sessionId', 'text'], ['agent']) &&
    isSessionId(v['sessionId']) &&
    typeof v['text'] === 'string' &&
    v['text'].trim().length > 0 &&
    Buffer.byteLength(v['text'], 'utf8') <= HISTORY_MAX_TEXT_BYTES &&
    (v['agent'] === undefined ||
      (typeof v['agent'] === 'string' && v['agent'].length > 0 && v['agent'].length <= HISTORY_MAX_AGENT_LENGTH && !/[\r\n]/.test(v['agent']))),
);

export const validateClipboardConfigure = singleRequest<ClipboardConfigureRequest>(
  (v) => hasExactKeys(v, ['enabled', 'paused']) && typeof v['enabled'] === 'boolean' && typeof v['paused'] === 'boolean',
);

export const validateClipboardSetActive = singleRequest<ClipboardSetActiveRequest>(
  (v) => hasExactKeys(v, ['sessionId']) && (v['sessionId'] === null || isSessionId(v['sessionId'])),
);

export const validateClipboardWrite = singleRequest<ClipboardWriteRequest>(
  (v) =>
    hasExactKeys(v, ['text']) &&
    typeof v['text'] === 'string' &&
    v['text'].length > 0 &&
    Buffer.byteLength(v['text'], 'utf8') <= CLIPBOARD_WRITE_MAX_BYTES,
);

const isActionTemplate = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0 && Buffer.byteLength(value, 'utf8') <= AI_TEMPLATE_MAX_BYTES && !value.includes('\0');

const isActionTextField = (value: unknown, max: number): boolean =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\r\n]/.test(value);

const isActionDefinition = (value: unknown): value is AiActionDefinition =>
  isPlainRecord(value) &&
  hasExactKeys(value, ['id', 'title', 'description', 'systemTemplate', 'userTemplate'], ['builtIn']) &&
  (value['builtIn'] === undefined || typeof value['builtIn'] === 'boolean') &&
  typeof value['id'] === 'string' &&
  value['id'].length > 0 &&
  value['id'].length <= 64 &&
  isActionTextField(value['title'], AI_ACTION_TITLE_MAX) &&
  isActionTextField(value['description'], AI_ACTION_DESCRIPTION_MAX) &&
  isActionTemplate(value['systemTemplate']) &&
  isActionTemplate(value['userTemplate']);

export const validateAiActionsSave = singleRequest<AiActionsSaveRequest>((v) => hasExactKeys(v, ['action']) && isActionDefinition(v['action']));

const isActionId = (value: unknown): boolean => typeof value === 'string' && value.length > 0 && value.length <= 64;

export const validateAiActionsReset = singleRequest<AiActionsResetRequest>((v) => hasExactKeys(v, ['id']) && isActionId(v['id']));
export const validateAiActionsDelete = singleRequest<AiActionsDeleteRequest>((v) => hasExactKeys(v, ['id']) && isActionId(v['id']));

const AI_OS_VALUES = ['linux', 'macos', 'windows', 'unknown'];
const AI_SHELL_VALUES = ['bash', 'zsh', 'fish', 'sh', 'pwsh', 'powershell', 'cmd', 'unknown'];

const isAiEnvironment = (value: unknown): boolean =>
  isPlainRecord(value) &&
  hasExactKeys(value, ['os', 'shell'], ['source']) &&
  typeof value['os'] === 'string' &&
  AI_OS_VALUES.includes(value['os']) &&
  typeof value['shell'] === 'string' &&
  AI_SHELL_VALUES.includes(value['shell']) &&
  (value['source'] === undefined || value['source'] === 'local' || value['source'] === 'ssh-probe' || value['source'] === 'unknown');

export const validateAiCompose = singleRequest<AiComposeRequest>(
  (v) =>
    hasExactKeys(v, ['actionId', 'composerText'], ['consoleText', 'terminalInfo', 'environment']) &&
    typeof v['actionId'] === 'string' && v['actionId'].length > 0 && v['actionId'].length <= 64 &&
    typeof v['composerText'] === 'string' && Buffer.byteLength(v['composerText'], 'utf8') <= AI_ACTION_MAX_PROMPT_BYTES &&
    (v['consoleText'] === undefined || (typeof v['consoleText'] === 'string' && Buffer.byteLength(v['consoleText'], 'utf8') <= AI_ACTION_MAX_PROMPT_BYTES)) &&
    (v['terminalInfo'] === undefined || (typeof v['terminalInfo'] === 'string' && v['terminalInfo'].length <= 512)) &&
    (v['environment'] === undefined || isAiEnvironment(v['environment'])),
);

export const validateAiAction = singleRequest<AiActionRequest>(
  (v) =>
    hasExactKeys(v, ['actionId', 'system', 'user']) &&
    typeof v['actionId'] === 'string' && v['actionId'].length > 0 && v['actionId'].length <= 64 &&
    typeof v['system'] === 'string' && v['system'].trim().length > 0 && Buffer.byteLength(v['system'], 'utf8') <= AI_RENDERED_PROMPT_MAX_BYTES &&
    typeof v['user'] === 'string' && v['user'].trim().length > 0 && Buffer.byteLength(v['user'], 'utf8') <= AI_RENDERED_PROMPT_MAX_BYTES &&
    Buffer.byteLength(v['system'], 'utf8') + Buffer.byteLength(v['user'], 'utf8') <= AI_RENDERED_PROMPT_MAX_BYTES,
);

export const validateAiCorrect = singleRequest<AiCorrectRequest>(
  (v) =>
    hasExactKeys(v, ['text']) &&
    typeof v['text'] === 'string' &&
    v['text'].trim().length > 0 &&
    Buffer.byteLength(v['text'], 'utf8') <= AI_CORRECTION_MAX_TEXT_BYTES &&
    !/[\u0000-\u001f\u007f]/.test(v['text']),
);

export const validateHelpTopic = singleRequest<{ topic: HelpTopic }>(
  (v) => hasExactKeys(v, ['topic']) && (v['topic'] === 'repository' || v['topic'] === 'ai' || v['topic'] === 'stt' || v['topic'] === 'troubleshooting'),
);

export const validateAiModels = singleRequest<AiModelsRequest>(
  (v) =>
    hasExactKeys(v, [], ['config', 'aiToken']) &&
    (v['config'] === undefined || isPlainRecord(v['config'])) &&
    (v['aiToken'] === undefined || (typeof v['aiToken'] === 'string' && v['aiToken'].length <= 4096 && !/[\u0000-\u001f\u007f]/.test(v['aiToken']))),
);

export const validateSetupTestAi = singleRequest<SetupTestAiRequest>(
  (v) =>
    hasExactKeys(v, ['config'], ['aiToken']) &&
    isPlainRecord(v['config']) &&
    (v['aiToken'] === undefined || (typeof v['aiToken'] === 'string' && v['aiToken'].length <= 4096 && !/[\u0000-\u001f\u007f]/.test(v['aiToken']))),
);

const isOptionalIso = (value: unknown): boolean => value === undefined || (typeof value === 'string' && isIsoTimestamp(value));

export const validateSttSaveDebugAudio = singleRequest<SttSaveDebugAudioRequest>(
  (v) => hasExactKeys(v, ['audio','mimeType'], ['durationMs']) && v['audio'] instanceof Uint8Array && v['audio'].byteLength > 0 && v['audio'].byteLength <= STT_MAX_AUDIO_BYTES && isAudioMimeType(v['mimeType']) && (v['durationMs'] === undefined || (typeof v['durationMs'] === 'number' && Number.isInteger(v['durationMs']) && v['durationMs'] >= 0 && v['durationMs'] <= 60000)),
);

export const validateSttTranscribe = singleRequest<SttTranscribeRequest>(
  (v) =>
    hasExactKeys(v, ['audio', 'mimeType'], ['durationMs']) &&
    (v['durationMs'] === undefined || (typeof v['durationMs'] === 'number' && Number.isFinite(v['durationMs']) && Number.isInteger(v['durationMs']) && v['durationMs'] >= 0 && v['durationMs'] <= 60000)) &&
    v['audio'] instanceof Uint8Array &&
    v['audio'].byteLength > 0 &&
    v['audio'].byteLength <= STT_MAX_AUDIO_BYTES &&
    isAudioMimeType(v['mimeType']),
);

export const validateSearchQuery = singleRequest<SearchQueryRequest>(
  (v) =>
    hasExactKeys(v, ['query'], ['machine', 'sessionId', 'from', 'to', 'kind']) &&
    typeof v['query'] === 'string' &&
    v['query'].length <= SEARCH_MAX_QUERY_LENGTH &&
    (v['machine'] === undefined || (typeof v['machine'] === 'string' && isValidMachine(v['machine']))) &&
    (v['sessionId'] === undefined || isSessionId(v['sessionId'])) &&
    isOptionalIso(v['from']) &&
    isOptionalIso(v['to']) &&
    (v['kind'] === undefined || v['kind'] === 'history' || v['kind'] === 'clipboard'),
);

const isSessionDirectoryPath = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 300) {
    return false;
  }
  const segments = value.split('/');
  const [root, machine, directory] = segments;
  return (
    segments.length === 3 &&
    root === 'sessions' &&
    machine !== undefined &&
    isValidMachine(machine) &&
    directory !== undefined &&
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}\.[0-9]{2}_S[1-9][0-9]*_[A-Za-z0-9._-]+$/.test(directory)
  );
};

export const validateSearchRemove = singleRequest<SearchRemoveRequest>(
  (v) =>
    hasExactKeys(v, ['kind', 'sessionDirectory', 'id']) &&
    (v['kind'] === 'history' || v['kind'] === 'clipboard') &&
    isSessionDirectoryPath(v['sessionDirectory']) &&
    typeof v['id'] === 'string' &&
    /^[A-Za-z0-9_.-]{1,64}$/.test(v['id']),
);

export const validateOnboardingValidate = singleRequest<OnboardingValidateRequest>((v) => hasExactKeys(v, ['config']) && isPlainRecord(v['config']));

export const validateOnboardingSave = singleRequest<OnboardingSaveRequest>(
  (v) =>
    hasExactKeys(v, ['config'], ['aiToken', 'sttToken']) &&
    isPlainRecord(v['config']) &&
    (v['aiToken'] === undefined || typeof v['aiToken'] === 'string') &&
    (v['sttToken'] === undefined || typeof v['sttToken'] === 'string'),
);

export const validateSecretsLogout = singleRequest<SecretsLogoutRequest>((v) => hasExactKeys(v, ['key']) && typeof v['key'] === 'string' && v['key'].length <= 64);

export interface IpcChannelMap {
  [IPC_CHANNELS.appPing]: ChannelDefinition<[], AppPingResult>;
  [IPC_CHANNELS.appRuntimeInfo]: ChannelDefinition<[], AppRuntimeInfo>;
  [IPC_CHANNELS.terminalCreate]: ChannelDefinition<[TerminalCreateRequest], TerminalSessionInfo>;
  [IPC_CHANNELS.terminalWrite]: ChannelDefinition<[TerminalWriteRequest], void>;
  [IPC_CHANNELS.terminalResize]: ChannelDefinition<[TerminalResizeRequest], void>;
  [IPC_CHANNELS.terminalClose]: ChannelDefinition<[TerminalCloseRequest], void>;
  [IPC_CHANNELS.terminalList]: ChannelDefinition<[], TerminalSessionInfo[]>;
  [IPC_CHANNELS.terminalDetectEnvironment]: ChannelDefinition<[TerminalDetectEnvironmentRequest], SessionEnvironment>;
  [IPC_CHANNELS.historyRecord]: ChannelDefinition<[HistoryRecordRequest], HistoryRecordResult>;
  [IPC_CHANNELS.clipboardConfigure]: ChannelDefinition<[ClipboardConfigureRequest], ClipboardCaptureState>;
  [IPC_CHANNELS.clipboardSetActive]: ChannelDefinition<[ClipboardSetActiveRequest], ClipboardCaptureState>;
  [IPC_CHANNELS.clipboardClear]: ChannelDefinition<[], ClipboardCaptureState>;
  [IPC_CHANNELS.clipboardState]: ChannelDefinition<[], ClipboardCaptureState>;
  [IPC_CHANNELS.clipboardWrite]: ChannelDefinition<[ClipboardWriteRequest], void>;
  [IPC_CHANNELS.searchQuery]: ChannelDefinition<[SearchQueryRequest], SearchQueryResult>;
  [IPC_CHANNELS.searchFacets]: ChannelDefinition<[], SearchFacetsResult>;
  [IPC_CHANNELS.searchRemove]: ChannelDefinition<[SearchRemoveRequest], SearchRemoveResult>;
  [IPC_CHANNELS.syncStatus]: ChannelDefinition<[], SyncStatusEvent>;
  [IPC_CHANNELS.sshAliases]: ChannelDefinition<[], string[]>;
  [IPC_CHANNELS.onboardingState]: ChannelDefinition<[], OnboardingState>;
  [IPC_CHANNELS.onboardingValidate]: ChannelDefinition<[OnboardingValidateRequest], OnboardingValidationResult>;
  [IPC_CHANNELS.onboardingSave]: ChannelDefinition<[OnboardingSaveRequest], OnboardingSaveResult>;
  [IPC_CHANNELS.onboardingSkip]: ChannelDefinition<[], OnboardingSaveResult>;
  [IPC_CHANNELS.setupTestRemote]: ChannelDefinition<[OnboardingValidateRequest], RemoteSetupResult>;
  [IPC_CHANNELS.secretsStatus]: ChannelDefinition<[], SecretsStatus>;
  [IPC_CHANNELS.secretsLogout]: ChannelDefinition<[SecretsLogoutRequest], SecretsStatus>;
  [IPC_CHANNELS.appRelaunch]: ChannelDefinition<[], void>;
  [IPC_CHANNELS.windowControl]: ChannelDefinition<[{ action: WindowControlAction }], void>;
  [IPC_CHANNELS.aiStatus]: ChannelDefinition<[], AiStatus>;
  [IPC_CHANNELS.aiModels]: ChannelDefinition<[AiModelsRequest], AiModelInfo[]>;
  [IPC_CHANNELS.aiCorrect]: ChannelDefinition<[AiCorrectRequest], CorrectionResult>;
  [IPC_CHANNELS.aiCompose]: ChannelDefinition<[AiComposeRequest], AiComposeResult>;
  [IPC_CHANNELS.aiAction]: ChannelDefinition<[AiActionRequest], AiActionResult>;
  [IPC_CHANNELS.aiActionsList]: ChannelDefinition<[], AiActionsState>;
  [IPC_CHANNELS.aiActionsSave]: ChannelDefinition<[AiActionsSaveRequest], AiActionsState>;
  [IPC_CHANNELS.aiActionsReset]: ChannelDefinition<[AiActionsResetRequest], AiActionsState>;
  [IPC_CHANNELS.aiActionsDelete]: ChannelDefinition<[AiActionsDeleteRequest], AiActionsState>;
  [IPC_CHANNELS.setupTestAi]: ChannelDefinition<[SetupTestAiRequest], SetupTestAiResult>;
  [IPC_CHANNELS.helpOpen]: ChannelDefinition<[{ topic: HelpTopic }], HelpOpenResult>;
  [IPC_CHANNELS.sttStatus]: ChannelDefinition<[], SttStatus>;
  [IPC_CHANNELS.sttModels]: ChannelDefinition<[], SttModelInfo[]>;
  [IPC_CHANNELS.sttTranscribe]: ChannelDefinition<[SttTranscribeRequest], SttTranscribeResult>;
  [IPC_CHANNELS.sttSaveDebugAudio]: ChannelDefinition<[SttSaveDebugAudioRequest], SttSaveDebugAudioResult>;
}

function buildAppChannels(env: RuntimeEnvironment, services: IpcServices): Pick<IpcChannelMap, typeof IPC_CHANNELS.appPing | typeof IPC_CHANNELS.appRuntimeInfo | typeof IPC_CHANNELS.appRelaunch | typeof IPC_CHANNELS.windowControl | typeof IPC_CHANNELS.helpOpen> {
  return {
    [IPC_CHANNELS.appPing]: {
      validate: noArguments,
      handle: () => ({ appVersion: env.appVersion, platform: env.platform }),
    },
    [IPC_CHANNELS.appRuntimeInfo]: {
      validate: noArguments,
      handle: () => ({ appVersion: env.appVersion, platform: env.platform, isPackaged: env.isPackaged, isPrimary: env.isPrimary() }),
    },
    [IPC_CHANNELS.appRelaunch]: {
      validate: noArguments,
      handle: () => services.app.relaunch(),
    },
    [IPC_CHANNELS.windowControl]: {
      validate: validateWindowControl,
      handle: (sender, { action }) => services.window.control(sender.senderId, action),
    },
    [IPC_CHANNELS.helpOpen]: {
      validate: validateHelpTopic,
      handle: (_sender, { topic }) => services.help.open(topic),
    },
  };
}

function buildTerminalChannels(terminals: TerminalGateway): Pick<IpcChannelMap, typeof IPC_CHANNELS.terminalCreate | typeof IPC_CHANNELS.terminalWrite | typeof IPC_CHANNELS.terminalResize | typeof IPC_CHANNELS.terminalClose | typeof IPC_CHANNELS.terminalList | typeof IPC_CHANNELS.terminalDetectEnvironment> {
  return {
    [IPC_CHANNELS.terminalCreate]: {
      validate: validateTerminalCreate,
      handle: (sender, request) => terminals.create(sender.senderId, request),
    },
    [IPC_CHANNELS.terminalWrite]: {
      validate: validateTerminalWrite,
      handle: (sender, { sessionId, data }) => terminals.write(sender.senderId, sessionId, data),
    },
    [IPC_CHANNELS.terminalResize]: {
      validate: validateTerminalResize,
      handle: (sender, { sessionId, cols, rows }) => terminals.resize(sender.senderId, sessionId, cols, rows),
    },
    [IPC_CHANNELS.terminalClose]: {
      validate: validateTerminalClose,
      handle: (sender, { sessionId }) => terminals.close(sender.senderId, sessionId),
    },
    [IPC_CHANNELS.terminalList]: {
      validate: noArguments,
      handle: (sender) => terminals.list(sender.senderId),
    },
    [IPC_CHANNELS.terminalDetectEnvironment]: {
      validate: validateTerminalDetectEnvironment,
      handle: (sender, request) => terminals.detectEnvironment(sender.senderId, request.sessionId),
    },
  };
}

function buildCaptureChannels(services: IpcServices): Pick<IpcChannelMap, typeof IPC_CHANNELS.historyRecord | typeof IPC_CHANNELS.clipboardConfigure | typeof IPC_CHANNELS.clipboardSetActive | typeof IPC_CHANNELS.clipboardClear | typeof IPC_CHANNELS.clipboardState | typeof IPC_CHANNELS.clipboardWrite> {
  return {
    [IPC_CHANNELS.historyRecord]: {
      validate: validateHistoryRecord,
      handle: (sender, request) => services.history.record(sender.senderId, request),
    },
    [IPC_CHANNELS.clipboardConfigure]: {
      validate: validateClipboardConfigure,
      handle: (_sender, request) => services.clipboard.configure(request),
    },
    [IPC_CHANNELS.clipboardSetActive]: {
      validate: validateClipboardSetActive,
      handle: (sender, request) => services.clipboard.setActive(sender.senderId, request),
    },
    [IPC_CHANNELS.clipboardClear]: {
      validate: noArguments,
      handle: () => services.clipboard.clear(),
    },
    [IPC_CHANNELS.clipboardState]: {
      validate: noArguments,
      handle: () => services.clipboard.state(),
    },
    [IPC_CHANNELS.clipboardWrite]: {
      validate: validateClipboardWrite,
      handle: (_sender, { text }) => services.clipboardWriter.writeText(text),
    },
  };
}

function buildIndexChannels(services: IpcServices): Pick<IpcChannelMap, typeof IPC_CHANNELS.searchQuery | typeof IPC_CHANNELS.searchFacets | typeof IPC_CHANNELS.searchRemove | typeof IPC_CHANNELS.syncStatus | typeof IPC_CHANNELS.sshAliases> {
  return {
    [IPC_CHANNELS.searchQuery]: {
      validate: validateSearchQuery,
      handle: (_sender, request) => services.search.query(request),
    },
    [IPC_CHANNELS.searchFacets]: {
      validate: noArguments,
      handle: () => services.search.facets(),
    },
    [IPC_CHANNELS.searchRemove]: {
      validate: validateSearchRemove,
      handle: (_sender, request) => services.search.remove(request),
    },
    [IPC_CHANNELS.syncStatus]: {
      validate: noArguments,
      handle: () => services.sync.status(),
    },
    [IPC_CHANNELS.sshAliases]: {
      validate: noArguments,
      handle: () => services.ssh.aliases(),
    },
  };
}

function buildSetupChannels(services: IpcServices): Pick<IpcChannelMap, typeof IPC_CHANNELS.onboardingState | typeof IPC_CHANNELS.onboardingValidate | typeof IPC_CHANNELS.onboardingSave | typeof IPC_CHANNELS.onboardingSkip | typeof IPC_CHANNELS.setupTestRemote | typeof IPC_CHANNELS.secretsStatus | typeof IPC_CHANNELS.secretsLogout> {
  return {
    [IPC_CHANNELS.onboardingState]: {
      validate: noArguments,
      handle: () => services.onboarding.state(),
    },
    [IPC_CHANNELS.onboardingValidate]: {
      validate: validateOnboardingValidate,
      handle: (_sender, { config }) => services.onboarding.validate(config),
    },
    [IPC_CHANNELS.onboardingSave]: {
      validate: validateOnboardingSave,
      handle: (_sender, request) => services.onboarding.save(request),
    },
    [IPC_CHANNELS.onboardingSkip]: {
      validate: noArguments,
      handle: () => services.onboarding.skip(),
    },
    [IPC_CHANNELS.setupTestRemote]: {
      validate: validateOnboardingValidate,
      handle: (_sender, { config }) => services.onboarding.testRemote(config),
    },
    [IPC_CHANNELS.secretsStatus]: {
      validate: noArguments,
      handle: () => services.onboarding.secretsStatus(),
    },
    [IPC_CHANNELS.secretsLogout]: {
      validate: validateSecretsLogout,
      handle: (_sender, { key }) => services.onboarding.logout(key),
    },
  };
}

function buildAiChannels(services: IpcServices): Pick<IpcChannelMap, typeof IPC_CHANNELS.aiStatus | typeof IPC_CHANNELS.aiModels | typeof IPC_CHANNELS.aiCorrect | typeof IPC_CHANNELS.aiCompose | typeof IPC_CHANNELS.aiAction | typeof IPC_CHANNELS.aiActionsList | typeof IPC_CHANNELS.aiActionsSave | typeof IPC_CHANNELS.aiActionsReset | typeof IPC_CHANNELS.aiActionsDelete | typeof IPC_CHANNELS.setupTestAi | typeof IPC_CHANNELS.sttStatus | typeof IPC_CHANNELS.sttModels | typeof IPC_CHANNELS.sttSaveDebugAudio | typeof IPC_CHANNELS.sttTranscribe> {
  return {
    [IPC_CHANNELS.aiStatus]: {
      validate: noArguments,
      handle: () => services.ai.status(),
    },
    [IPC_CHANNELS.aiModels]: {
      validate: validateAiModels,
      handle: (_sender, request) => services.ai.models(request),
    },
    [IPC_CHANNELS.aiCorrect]: {
      validate: validateAiCorrect,
      handle: (_sender, request) => services.ai.correct(request),
    },
    [IPC_CHANNELS.aiCompose]: {
      validate: validateAiCompose,
      handle: (_sender, request) => services.ai.compose(request),
    },
    [IPC_CHANNELS.aiAction]: {
      validate: validateAiAction,
      handle: (_sender, request) => services.ai.action(request),
    },
    [IPC_CHANNELS.aiActionsList]: {
      validate: noArguments,
      handle: () => services.aiActions.list(),
    },
    [IPC_CHANNELS.aiActionsSave]: {
      validate: validateAiActionsSave,
      handle: (_sender, request) => services.aiActions.save(request),
    },
    [IPC_CHANNELS.aiActionsReset]: {
      validate: validateAiActionsReset,
      handle: (_sender, request) => services.aiActions.reset(request),
    },
    [IPC_CHANNELS.aiActionsDelete]: {
      validate: validateAiActionsDelete,
      handle: (_sender, request) => services.aiActions.delete(request),
    },
    [IPC_CHANNELS.setupTestAi]: {
      validate: validateSetupTestAi,
      handle: (_sender, request) => {
        const validation = validateOnboardingConfig(request.config, false);
        if (!validation.ok) return { ok: false, provider: request.config.aiProvider, error: 'Invalid AI configuration.' };
        return services.ai.testConnection(request);
      },
    },
    [IPC_CHANNELS.sttStatus]: {
      validate: noArguments,
      handle: () => services.stt.status(),
    },
    [IPC_CHANNELS.sttModels]: {
      validate: noArguments,
      handle: () => services.stt.models(),
    },
    // Audio travels as Uint8Array (structured clone): the limit increases to 10 MiB plus overhead for the JSON wrapper.
    [IPC_CHANNELS.sttSaveDebugAudio]: {
      validate: validateSttSaveDebugAudio,
      handle: (_sender, request) => services.stt.saveDebugAudio(request),
      maxPayloadBytes: STT_MAX_AUDIO_BYTES + 4096,
    },
    [IPC_CHANNELS.sttTranscribe]: {
      validate: validateSttTranscribe,
      handle: (_sender, request) => services.stt.transcribe(request),
      maxPayloadBytes: STT_MAX_AUDIO_BYTES + 4096,
    },
  };
}

export function createChannelMap(env: RuntimeEnvironment, terminals: TerminalGateway, services: IpcServices): IpcChannelMap {
  // Channels are grouped by the service that owns them; sender/size/validation semantics stay per channel.
  return {
    ...buildAppChannels(env, services),
    ...buildTerminalChannels(terminals),
    ...buildCaptureChannels(services),
    ...buildIndexChannels(services),
    ...buildSetupChannels(services),
    ...buildAiChannels(services),
  };
}

const binaryByteLength = (value: unknown): number | undefined => {
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return value.byteLength;
  }
  return undefined;
};

/**
 * Payload size as Electron sees it: binary buffers count their real bytes
 * (`JSON.stringify` would expand them into an array of numbers); the rest is serialized.
 */
function checkPayloadSize(args: unknown[], limit: number): void {
  let total = 0;
  const rest = args.map((arg) => {
    const bytes = binaryByteLength(arg);
    if (bytes !== undefined) {
      total += bytes;
      return null;
    }
    if (!isPlainRecord(arg)) {
      return arg;
    }
    const shallow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(arg)) {
      const nested = binaryByteLength(value);
      if (nested !== undefined) {
        total += nested;
      } else {
        shallow[key] = value;
      }
    }
    return shallow;
  });
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(rest);
  } catch {
    throw new IpcError('IPC_INVALID_PAYLOAD');
  }
  total += serialized === undefined ? 0 : Buffer.byteLength(serialized, 'utf8');
  if (total > limit) {
    throw new IpcError('IPC_PAYLOAD_TOO_LARGE');
  }
}

/**
 * Executes a channel: sender -> size -> validation -> handler.
 * Non-IpcError failures are masked as IPC_INTERNAL.
 */
export async function dispatchIpc(
  definition: ChannelDefinition<never[], unknown> | ChannelDefinition<unknown[], unknown>,
  sender: SenderInfo,
  policy: SenderPolicy,
  args: unknown[],
): Promise<unknown> {
  if (!isSenderAllowed(sender, policy)) {
    throw new IpcError('IPC_INVALID_SENDER');
  }
  const def = definition as ChannelDefinition<unknown[], unknown>;
  checkPayloadSize(args, def.maxPayloadBytes ?? MAX_PAYLOAD_BYTES);
  let valid = false;
  try {
    valid = def.validate(args);
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new IpcError('IPC_INVALID_PAYLOAD');
  }
  try {
    return await def.handle(sender, ...args);
  } catch (error) {
    if (error instanceof TerminalError) {
      throw new Error(error.code);
    }
    throw new IpcError('IPC_INTERNAL');
  }
}

export function isApprovedChannel(channels: IpcChannelMap, channel: string): channel is IpcChannel {
  return Object.prototype.hasOwnProperty.call(channels, channel);
}
