import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeMachine } from '@smart-terminal/data';
import {
  AI_PROVIDERS,
  STT_AI_PROVIDERS,
  STT_PROVIDERS,
  TERMINAL_FONT_IDS,
  type TerminalFontId,
  type OnboardingConfig,
  type OnboardingSaveRequest,
  type OnboardingSaveResult,
  type RemoteSetupResult,
  type OnboardingState,
  type OnboardingValidationResult,
  type SecretsStatus,
} from '@smart-terminal/contracts';
import { configValidators, type AppConfig, type AppConfigStore, type ConfigLoadResult } from './app-config';
import { resolveDataPaths, type DataPaths } from './data-runtime';
import { isValidSecretKey, isValidSecretToken, type SecretStore } from './secret-store';
import { InstanceRegistrar } from './instance-registration';
import type { InstallationIdentity } from './installation-store';

export interface OnboardingServiceOptions {
  userDataPath: string;
  env: NodeJS.ProcessEnv;
  hostname?: () => string;
  store: AppConfigStore;
  secrets: SecretStore;
  /** Paths actually used by this instance (per `restartRequired`). */
  runningPaths: DataPaths;
  runningRemote: string | undefined;
  /** Result of reading config.md at startup. */
  initialLoad: ConfigLoadResult;
  installation: InstallationIdentity;
  appVersion: string;
  platform: string;
  arch: string;
}

const MESSAGES = {
  machineName: 'Invalid machine name.',
  dataRepoPath: 'Invalid path: it must be absolute, creatable and writable.',
  dataRepoRemote: 'Invalid Git remote.',
  aiProvider: 'Invalid AI provider.',
  aiBaseUrl: 'Invalid URL: use http(s) without credentials or query.',
  aiModel: 'Invalid model name.',
  sttProvider: 'Invalid STT provider.',
  sttModel: 'Invalid model name.',
  sttBaseUrl: 'Invalid URL: use http(s) without credentials or query.',
  sttResponseFormat: 'Invalid response format.',
  sttLanguage: 'Invalid language.',
  sttCommand: 'Invalid command: an absolute executable path is required.',
  terminalFont: 'Invalid terminal font.',
  terminalTheme: 'Invalid terminal theme.',
  aiToken: 'Invalid token.',
  sttToken: 'Invalid token.',
} as const;

/** The path exists and is a writable directory, or its nearest existing ancestor is writable (so it can be created). */
export function isWritableOrCreatable(target: string): boolean {
  let current = target;
  for (let depth = 0; depth < 64; depth += 1) {
    try {
      const stat = fs.statSync(current);
      if (!stat.isDirectory()) {
        return false;
      }
      fs.accessSync(current, fs.constants.W_OK);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        return false;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return false;
      }
      current = parent;
    }
  }
  return false;
}

const isOptionalText = (value: unknown, valid: (text: string) => boolean): boolean =>
  value === undefined || (typeof value === 'string' && valid(value));

/** Complete validation of the wizard payload (types, enums, URLs, paths); fixed, sanitized messages. */
export function validateOnboardingConfig(config: unknown, fieldChecks = true): OnboardingValidationResult {
  const errors: Record<string, string> = {};
  if (typeof config !== 'object' || config === null) {
    return { ok: false, errors: { config: 'Invalid configuration.' } };
  }
  const c = config as Record<string, unknown>;
  const fail = (field: keyof typeof MESSAGES): void => {
    errors[field] = MESSAGES[field];
  };
  if (typeof c['machineName'] !== 'string' || !configValidators.machineName(c['machineName'])) fail('machineName');
  if (
    typeof c['dataRepoPath'] !== 'string' ||
    !configValidators.dataRepoPath(c['dataRepoPath']) ||
    (fieldChecks && !isWritableOrCreatable(path.resolve(c['dataRepoPath'])))
  ) {
    fail('dataRepoPath');
  }
  if (!isOptionalText(c['dataRepoRemote'], configValidators.dataRepoRemote)) fail('dataRepoRemote');
  if (!AI_PROVIDERS.some((p) => p === c['aiProvider'])) fail('aiProvider');
  if (!isOptionalText(c['aiBaseUrl'], configValidators.aiBaseUrl)) fail('aiBaseUrl');
  if (!isOptionalText(c['aiModel'], configValidators.modelName)) fail('aiModel');
  if (!STT_PROVIDERS.some((p) => p === c['sttProvider'])) fail('sttProvider');
  if (c['sttUseAiProvider'] !== undefined && typeof c['sttUseAiProvider'] !== 'boolean') errors['sttUseAiProvider'] = 'Invalid setting.';
  if (c['sttApiProvider'] !== undefined && c['sttApiProvider'] !== '' && !STT_AI_PROVIDERS.some((p) => p === c['sttApiProvider'])) errors['sttApiProvider'] = 'Invalid setting.';
  if (!isOptionalText(c['sttModel'], configValidators.modelName)) fail('sttModel');
  if (!isOptionalText(c['sttBaseUrl'], configValidators.aiBaseUrl)) fail('sttBaseUrl');
  if (c['sttResponseFormat'] !== undefined && c['sttResponseFormat'] !== 'json' && c['sttResponseFormat'] !== 'verbose_json') fail('sttResponseFormat');
  if (!isOptionalText(c['sttLanguage'], configValidators.sttLanguage)) fail('sttLanguage');
  if (!isOptionalText(c['sttCommand'], configValidators.sttCommand)) fail('sttCommand');
  if (c['terminalFont'] !== undefined && c['terminalFont'] !== '' && !TERMINAL_FONT_IDS.some((id) => id === c['terminalFont'])) fail('terminalFont');
  if (c['terminalTheme'] !== undefined && c['terminalTheme'] !== '' && c['terminalTheme'] !== 'dark' && c['terminalTheme'] !== 'light') fail('terminalTheme');
  const extra = Object.keys(c).filter((key) => !['machineName', 'dataRepoPath', 'dataRepoRemote', 'aiProvider', 'aiBaseUrl', 'aiModel', 'sttProvider', 'sttUseAiProvider', 'sttApiProvider', 'sttModel', 'sttBaseUrl', 'sttResponseFormat', 'sttLanguage', 'sttCommand', 'terminalFont', 'terminalTheme'].includes(key));
  if (extra.length > 0) errors['config'] = 'Invalid configuration.';
  return { ok: Object.keys(errors).length === 0, errors };
}

const empty = (value: string | undefined): string | undefined => (value === undefined || value.trim().length === 0 ? undefined : value.trim());

/** Main wizard logic: state, validation, config.md + token saving (never returned). */
export class OnboardingService {
  private config: AppConfig | undefined;
  private reason: 'missing' | 'corrupt' | 'valid';

  constructor(private readonly options: OnboardingServiceOptions) {
    this.config = options.initialLoad.status === 'valid' ? options.initialLoad.config : undefined;
    this.reason = options.initialLoad.status;
  }

  private hostname(): string {
    return (this.options.hostname ?? os.hostname)();
  }

  private envOverridesRepo(): boolean {
    const repo = this.options.env['SMART_TERMINAL_DATA_REPO'];
    return repo !== undefined && repo.length > 0;
  }

  private defaults(): OnboardingConfig {
    return {
      machineName: normalizeMachine(this.hostname()),
      dataRepoPath: path.join(this.options.userDataPath, 'data'),
      aiProvider: 'none',
      sttProvider: 'none',
      terminalFont: 'jetbrains',
      terminalTheme: 'dark',
    };
  }

  private toOnboardingConfig(config: AppConfig): OnboardingConfig {
    return {
      machineName: config.machineName,
      dataRepoPath: config.dataRepoPath,
      ...(config.dataRepoRemote !== undefined && { dataRepoRemote: config.dataRepoRemote }),
      aiProvider: config.aiProvider,
      ...(config.aiBaseUrl !== undefined && { aiBaseUrl: config.aiBaseUrl }),
      ...(config.aiModel !== undefined && { aiModel: config.aiModel }),
      sttProvider: config.sttProvider,
      ...(config.sttUseAiProvider === true && { sttUseAiProvider: true }),
      ...(config.sttApiProvider !== undefined && { sttApiProvider: config.sttApiProvider }),
      ...(config.sttModel !== undefined && { sttModel: config.sttModel }),
      ...(config.sttBaseUrl !== undefined && { sttBaseUrl: config.sttBaseUrl }),
      ...(config.sttResponseFormat !== undefined && { sttResponseFormat: config.sttResponseFormat }),
      ...(config.sttLanguage !== undefined && { sttLanguage: config.sttLanguage }),
      ...(config.sttCommand !== undefined && { sttCommand: config.sttCommand }),
      terminalFont: config.terminalFont ?? 'jetbrains',
      terminalTheme: config.terminalTheme ?? 'dark',
    };
  }

  state(): OnboardingState {
    const valid = this.config !== undefined;
    const envOverride = !valid && this.envOverridesRepo();
    return {
      required: !valid && !envOverride,
      reason: valid ? 'valid' : envOverride ? 'env-override' : this.reason === 'corrupt' ? 'corrupt' : 'missing',
      config: this.config !== undefined ? this.toOnboardingConfig(this.config) : this.defaults(),
      secureStorage: this.options.secrets.isSecure(),
      storedSecrets: this.options.secrets.keys(),
    };
  }

  validate(config: unknown): OnboardingValidationResult {
    return validateOnboardingConfig(config);
  }

  /** Explicit setup check: writes and pushes a non-sensitive instance registration. */
  async testRemote(config: OnboardingConfig): Promise<RemoteSetupResult> {
    const validation = validateOnboardingConfig(config);
    if (!validation.ok) {
      return { ok: false, committed: false, pushed: false, localOnly: !config.dataRepoRemote, state: 'error', error: 'Invalid configuration' };
    }
    const registrar = new InstanceRegistrar({
      dataRepoPath: path.resolve(config.dataRepoPath),
      ...(config.dataRepoRemote !== undefined && config.dataRepoRemote.trim().length > 0 ? { remote: config.dataRepoRemote.trim() } : {}),
      machine: config.machineName,
      installationId: this.options.installation.installationId,
      installationCreatedAt: this.options.installation.createdAt,
      appVersion: this.options.appVersion,
      platform: this.options.platform,
      arch: this.options.arch,
    });
    return registrar.register();
  }

  save(request: OnboardingSaveRequest): OnboardingSaveResult {
    const validation = validateOnboardingConfig(request.config);
    const errors = { ...validation.errors };
    const tokens: [string, unknown][] = [
      ['aiToken', request.aiToken],
      ['sttToken', request.sttToken],
    ];
    for (const [field, token] of tokens) {
      if (token !== undefined && !isValidSecretToken(token)) {
        errors[field] = MESSAGES.aiToken;
      }
    }
    if (Object.keys(errors).length > 0) {
      return { ok: false, errors, restartRequired: false, warnings: [] };
    }
    const input = request.config;
    const baseRemote = empty(input.dataRepoRemote);
    const baseUrl = empty(input.aiBaseUrl);
    const aiModel = empty(input.aiModel);
    const sttModel = empty(input.sttModel);
    const sttBaseUrl = empty(input.sttBaseUrl);
    const sttLanguage = empty(input.sttLanguage);
    const sttCommand = input.sttProvider === 'local' ? empty(input.sttCommand) : undefined;
    const next: AppConfig = {
      ...(this.config ?? {}),
      machineName: input.machineName.trim(),
      dataRepoPath: path.resolve(input.dataRepoPath),
      aiProvider: input.aiProvider,
      sttProvider: input.sttProvider,
      terminalFont: (input.terminalFont ?? 'jetbrains') as TerminalFontId,
      terminalTheme: input.terminalTheme ?? 'dark',
    } as AppConfig;
    for (const key of ['dataRepoRemote', 'aiBaseUrl', 'aiModel', 'sttUseAiProvider', 'sttApiProvider', 'sttModel', 'sttBaseUrl', 'sttResponseFormat', 'sttLanguage', 'sttCommand'] as const) {
      delete next[key];
    }
    if (baseRemote !== undefined) next.dataRepoRemote = baseRemote;
    if (baseUrl !== undefined) next.aiBaseUrl = baseUrl;
    if (aiModel !== undefined) next.aiModel = aiModel;
    if (input.sttUseAiProvider === true) next.sttUseAiProvider = true;
    if (input.sttProvider === 'cloud' && input.sttUseAiProvider !== true && input.sttApiProvider !== undefined) next.sttApiProvider = input.sttApiProvider;
    if (sttModel !== undefined) next.sttModel = sttModel;
    if (sttBaseUrl !== undefined) next.sttBaseUrl = sttBaseUrl;
    if (input.sttResponseFormat !== undefined) next.sttResponseFormat = input.sttResponseFormat;
    if (sttLanguage !== undefined) next.sttLanguage = sttLanguage;
    if (sttCommand !== undefined) next.sttCommand = sttCommand;

    try {
      fs.mkdirSync(next.dataRepoPath, { recursive: true });
      this.options.store.save(next);
    } catch {
      return { ok: false, errors: { config: 'Could not save the configuration.' }, restartRequired: false, warnings: [] };
    }
    this.config = next;
    this.reason = 'valid';

    const warnings: string[] = [];
    const storeToken = (key: string, token: string | undefined): void => {
      if (token === undefined) {
        return;
      }
      try {
        const result = this.options.secrets.set(key, token);
        if (result.warning !== undefined && !warnings.includes(result.warning)) {
          warnings.push(result.warning);
        }
      } catch {
        warnings.push('Could not save the token.');
      }
    };
    if (next.aiProvider !== 'none') storeToken(`ai:${next.aiProvider}`, request.aiToken);
    if (next.sttProvider !== 'none' && !(next.sttProvider === 'cloud' && next.sttUseAiProvider === true)) storeToken(`stt:${next.sttProvider}`, request.sttToken);

    const effective = resolveDataPaths(this.options.userDataPath, this.options.env, this.options.hostname, next);
    const remoteEnv = this.options.env['SMART_TERMINAL_GIT_REMOTE'];
    const effectiveRemote = remoteEnv !== undefined && remoteEnv.length > 0 ? remoteEnv : next.dataRepoRemote;
    const restartRequired =
      effective.dataRepoPath !== this.options.runningPaths.dataRepoPath ||
      effective.machine !== this.options.runningPaths.machine ||
      effectiveRemote !== this.options.runningRemote;
    return { ok: true, errors: {}, restartRequired, warnings };
  }

  /** Skips the wizard: writes the configuration with default values (no encryption/network required). */
  skip(): OnboardingSaveResult {
    return this.save({ config: this.config !== undefined ? this.toOnboardingConfig(this.config) : this.defaults() });
  }

  secretsStatus(): SecretsStatus {
    return { secureStorage: this.options.secrets.isSecure(), storedSecrets: this.options.secrets.keys() };
  }

  logout(key: string): SecretsStatus {
    if (!isValidSecretKey(key)) {
      throw new Error('SECRET_INVALID');
    }
    this.options.secrets.delete(key);
    return this.secretsStatus();
  }
}
