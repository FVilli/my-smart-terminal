import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeMachine } from '@smart-terminal/data';
import {
  AI_PROVIDERS,
  STT_PROVIDERS,
  type OnboardingConfig,
  type OnboardingSaveRequest,
  type OnboardingSaveResult,
  type OnboardingState,
  type OnboardingValidationResult,
  type SecretsStatus,
} from '@smart-terminal/contracts';
import { configValidators, type AppConfig, type AppConfigStore, type ConfigLoadResult } from './app-config';
import { resolveDataPaths, type DataPaths } from './data-runtime';
import { isValidSecretKey, isValidSecretToken, type SecretStore } from './secret-store';

export interface OnboardingServiceOptions {
  userDataPath: string;
  env: NodeJS.ProcessEnv;
  hostname?: () => string;
  store: AppConfigStore;
  secrets: SecretStore;
  /** Percorsi effettivamente in uso da questa istanza (per `restartRequired`). */
  runningPaths: DataPaths;
  runningRemote: string | undefined;
  /** Esito della lettura di config.md all'avvio. */
  initialLoad: ConfigLoadResult;
}

const MESSAGES = {
  machineName: 'Nome macchina non valido.',
  dataRepoPath: 'Percorso non valido: deve essere assoluto, creabile e scrivibile.',
  dataRepoRemote: 'Remote Git non valido.',
  aiProvider: 'Provider AI non valido.',
  aiBaseUrl: 'URL non valido: usa http(s) senza credenziali o query.',
  aiModel: 'Nome modello non valido.',
  sttProvider: 'Provider STT non valido.',
  sttModel: 'Nome modello non valido.',
  aiToken: 'Token non valido.',
  sttToken: 'Token non valido.',
} as const;

/** Il percorso esiste ed e' una directory scrivibile, oppure l'antenato esistente piu' vicino lo e' (quindi e' creabile). */
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

/** Validazione completa del payload del wizard (tipi, enum, URL, path); messaggi fissi e sanificati. */
export function validateOnboardingConfig(config: unknown, fieldChecks = true): OnboardingValidationResult {
  const errors: Record<string, string> = {};
  if (typeof config !== 'object' || config === null) {
    return { ok: false, errors: { config: 'Configurazione non valida.' } };
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
  if (!isOptionalText(c['sttModel'], configValidators.modelName)) fail('sttModel');
  const extra = Object.keys(c).filter((key) => !['machineName', 'dataRepoPath', 'dataRepoRemote', 'aiProvider', 'aiBaseUrl', 'aiModel', 'sttProvider', 'sttModel'].includes(key));
  if (extra.length > 0) errors['config'] = 'Configurazione non valida.';
  return { ok: Object.keys(errors).length === 0, errors };
}

const empty = (value: string | undefined): string | undefined => (value === undefined || value.trim().length === 0 ? undefined : value.trim());

/** Logica main del wizard: stato, validazione, salvataggio config.md + token (mai restituiti). */
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
      ...(config.sttModel !== undefined && { sttModel: config.sttModel }),
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
    const next: AppConfig = {
      ...(this.config ?? {}),
      machineName: input.machineName.trim(),
      dataRepoPath: path.resolve(input.dataRepoPath),
      aiProvider: input.aiProvider,
      sttProvider: input.sttProvider,
    } as AppConfig;
    for (const key of ['dataRepoRemote', 'aiBaseUrl', 'aiModel', 'sttModel'] as const) {
      delete next[key];
    }
    if (baseRemote !== undefined) next.dataRepoRemote = baseRemote;
    if (baseUrl !== undefined) next.aiBaseUrl = baseUrl;
    if (aiModel !== undefined) next.aiModel = aiModel;
    if (sttModel !== undefined) next.sttModel = sttModel;

    try {
      fs.mkdirSync(next.dataRepoPath, { recursive: true });
      this.options.store.save(next);
    } catch {
      return { ok: false, errors: { config: 'Impossibile salvare la configurazione.' }, restartRequired: false, warnings: [] };
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
        warnings.push('Impossibile salvare il token.');
      }
    };
    if (next.aiProvider !== 'none') storeToken(`ai:${next.aiProvider}`, request.aiToken);
    if (next.sttProvider !== 'none') storeToken(`stt:${next.sttProvider}`, request.sttToken);

    const effective = resolveDataPaths(this.options.userDataPath, this.options.env, this.options.hostname, next);
    const remoteEnv = this.options.env['SMART_TERMINAL_GIT_REMOTE'];
    const effectiveRemote = remoteEnv !== undefined && remoteEnv.length > 0 ? remoteEnv : next.dataRepoRemote;
    const restartRequired =
      effective.dataRepoPath !== this.options.runningPaths.dataRepoPath ||
      effective.machine !== this.options.runningPaths.machine ||
      effectiveRemote !== this.options.runningRemote;
    return { ok: true, errors: {}, restartRequired, warnings };
  }

  /** Salta il wizard: scrive la configurazione con i valori predefiniti (nessuna cifratura/rete richiesta). */
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
