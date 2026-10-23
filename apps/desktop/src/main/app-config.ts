import fs from 'node:fs';
import path from 'node:path';
import {
  FrontmatterError,
  isValidMachine,
  normalizeMachine,
  parseFrontmatter,
  serializeFrontmatter,
  splitKnownFields,
  writeFileAtomic,
  type FrontmatterData,
} from '@smart-terminal/data';
import { AI_PROVIDERS, STT_PROVIDERS, type AiProvider, type SttProvider } from '@smart-terminal/contracts';

export const CONFIG_SCHEMA_VERSION = 1;

/** Configurazione locale (`config.md`): mai segreti, solo preferenze e riferimenti. */
export interface AppConfig {
  machineName: string;
  dataRepoPath: string;
  dataRepoRemote?: string;
  aiProvider: AiProvider;
  aiBaseUrl?: string;
  aiModel?: string;
  sttProvider: SttProvider;
  sttModel?: string;
  syncDebounceMs?: number;
  syncMaxWaitMs?: number;
  syncFetchIntervalMs?: number;
  clipboardEnabled?: boolean;
}

export class AppConfigError extends Error {
  constructor(readonly field: string) {
    super(`CONFIG_INVALID_FIELD: ${field}`);
    this.name = 'AppConfigError';
  }
}

const KNOWN_KEYS = [
  'schema_version',
  'machine_name',
  'data_repo_path',
  'data_repo_remote',
  'ai_provider',
  'ai_base_url',
  'ai_model',
  'stt_provider',
  'stt_model',
  'sync_debounce_ms',
  'sync_max_wait_ms',
  'sync_fetch_interval_ms',
  'clipboard_enabled',
] as const;

const hasControlCharacters = (value: string): boolean => [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

/** Validatori condivisi tra parser del file e wizard: restituiscono `true` se il valore e' accettabile. */
export const configValidators = {
  machineName: (value: string): boolean => value.trim().length > 0 && value.length <= 64 && !hasControlCharacters(value) && isValidMachine(normalizeMachine(value)),
  dataRepoPath: (value: string): boolean => value.length > 0 && value.length <= 4096 && !hasControlCharacters(value) && path.isAbsolute(value),
  /** Remote Git: URL/scp-like, senza opzioni (`-`), controlli e credenziali con password incorporate. */
  dataRepoRemote: (value: string): boolean =>
    value.length > 0 && value.length <= 2048 && !value.startsWith('-') && !hasControlCharacters(value) && !/\s/.test(value) && !/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/@]*:[^/@]*@/.test(value),
  /** URL http(s) senza credenziali o query (potrebbero contenere segreti). */
  aiBaseUrl: (value: string): boolean => {
    if (value.length > 2048 || hasControlCharacters(value)) {
      return false;
    }
    try {
      const url = new URL(value);
      return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.length > 0 && url.username === '' && url.password === '' && url.search === '' && url.hash === '';
    } catch {
      return false;
    }
  },
  modelName: (value: string): boolean => value.length > 0 && value.length <= 128 && !hasControlCharacters(value),
};

function optionalString(data: FrontmatterData, key: string, valid: (value: string) => boolean): string | undefined {
  const value = data[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string' || !valid(value)) {
    throw new AppConfigError(key);
  }
  return value;
}

function requiredString(data: FrontmatterData, key: string, valid: (value: string) => boolean): string {
  const value = optionalString(data, key, valid);
  if (value === undefined) {
    throw new AppConfigError(key);
  }
  return value;
}

function optionalMs(data: FrontmatterData, key: string): number | undefined {
  const value = data[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 86_400_000) {
    throw new AppConfigError(key);
  }
  return value;
}

function provider<T extends string>(data: FrontmatterData, key: string, allowed: readonly T[]): T {
  const value = data[key];
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) {
    throw new AppConfigError(key);
  }
  return match;
}

/** Parser validante: lancia `AppConfigError`/`FrontmatterError` su schema, tipi o campi sconosciuti non validi. */
export function parseAppConfig(content: string): AppConfig {
  const parsed = parseFrontmatter(content);
  if (!parsed.hasFrontmatter) {
    throw new AppConfigError('frontmatter');
  }
  const { known } = splitKnownFields(parsed.data, KNOWN_KEYS, 'reject');
  if (known['schema_version'] !== CONFIG_SCHEMA_VERSION) {
    throw new AppConfigError('schema_version');
  }
  const clipboard = known['clipboard_enabled'];
  if (clipboard !== undefined && clipboard !== null && typeof clipboard !== 'boolean') {
    throw new AppConfigError('clipboard_enabled');
  }
  const remote = optionalString(known, 'data_repo_remote', configValidators.dataRepoRemote);
  const baseUrl = optionalString(known, 'ai_base_url', configValidators.aiBaseUrl);
  const aiModel = optionalString(known, 'ai_model', configValidators.modelName);
  const sttModel = optionalString(known, 'stt_model', configValidators.modelName);
  const debounce = optionalMs(known, 'sync_debounce_ms');
  const maxWait = optionalMs(known, 'sync_max_wait_ms');
  const fetchInterval = optionalMs(known, 'sync_fetch_interval_ms');
  return {
    machineName: requiredString(known, 'machine_name', configValidators.machineName),
    dataRepoPath: requiredString(known, 'data_repo_path', configValidators.dataRepoPath),
    ...(remote !== undefined && { dataRepoRemote: remote }),
    aiProvider: provider(known, 'ai_provider', AI_PROVIDERS),
    ...(baseUrl !== undefined && { aiBaseUrl: baseUrl }),
    ...(aiModel !== undefined && { aiModel }),
    sttProvider: provider(known, 'stt_provider', STT_PROVIDERS),
    ...(sttModel !== undefined && { sttModel }),
    ...(debounce !== undefined && { syncDebounceMs: debounce }),
    ...(maxWait !== undefined && { syncMaxWaitMs: maxWait }),
    ...(fetchInterval !== undefined && { syncFetchIntervalMs: fetchInterval }),
    ...(typeof clipboard === 'boolean' && { clipboardEnabled: clipboard }),
  };
}

export function serializeAppConfig(config: AppConfig): string {
  const data: FrontmatterData = {
    schema_version: CONFIG_SCHEMA_VERSION,
    machine_name: config.machineName,
    data_repo_path: config.dataRepoPath,
    ...(config.dataRepoRemote !== undefined && { data_repo_remote: config.dataRepoRemote }),
    ai_provider: config.aiProvider,
    ...(config.aiBaseUrl !== undefined && { ai_base_url: config.aiBaseUrl }),
    ...(config.aiModel !== undefined && { ai_model: config.aiModel }),
    stt_provider: config.sttProvider,
    ...(config.sttModel !== undefined && { stt_model: config.sttModel }),
    ...(config.syncDebounceMs !== undefined && { sync_debounce_ms: config.syncDebounceMs }),
    ...(config.syncMaxWaitMs !== undefined && { sync_max_wait_ms: config.syncMaxWaitMs }),
    ...(config.syncFetchIntervalMs !== undefined && { sync_fetch_interval_ms: config.syncFetchIntervalMs }),
    ...(config.clipboardEnabled !== undefined && { clipboard_enabled: config.clipboardEnabled }),
  };
  // Rilegge cio' che sta per scrivere: un config non rileggibile non deve mai arrivare su disco.
  const content = serializeFrontmatter(data);
  parseAppConfig(content);
  return content;
}

export type ConfigLoadResult =
  | { status: 'valid'; config: AppConfig; restoredFromBackup: boolean }
  | { status: 'missing' }
  | { status: 'corrupt' };

/** Percorso di `config.md`: `SMART_TERMINAL_CONFIG_PATH` oppure `userData/config/config.md`. */
export function resolveConfigPath(userDataPath: string, env: NodeJS.ProcessEnv = process.env): string {
  const override = env['SMART_TERMINAL_CONFIG_PATH'];
  return path.resolve(override !== undefined && override.length > 0 ? override : path.join(userDataPath, 'config', 'config.md'));
}

const isParseFailure = (error: unknown): boolean => error instanceof AppConfigError || error instanceof FrontmatterError;

/** Persistenza atomica di `config.md` con backup `.bak` dell'ultima versione valida e quarantena `.corrupt`. */
export class AppConfigStore {
  constructor(readonly filePath: string) {}

  private get backupPath(): string {
    return `${this.filePath}.bak`;
  }

  private get corruptPath(): string {
    return `${this.filePath}.corrupt`;
  }

  load(): ConfigLoadResult {
    let content: string;
    try {
      content = fs.readFileSync(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { status: 'missing' };
      }
      return { status: 'corrupt' };
    }
    try {
      return { status: 'valid', config: parseAppConfig(content), restoredFromBackup: false };
    } catch (error) {
      if (!isParseFailure(error)) {
        return { status: 'corrupt' };
      }
    }
    return this.recover(content);
  }

  /** File corrotto: lo conserva come `.corrupt` e ripristina il backup solo se a sua volta valido. */
  private recover(corruptContent: string): ConfigLoadResult {
    try {
      writeFileAtomic(this.corruptPath, corruptContent);
    } catch {
      // la quarantena e' best effort
    }
    try {
      const backup = fs.readFileSync(this.backupPath, 'utf8');
      const config = parseAppConfig(backup);
      writeFileAtomic(this.filePath, backup);
      return { status: 'valid', config, restoredFromBackup: true };
    } catch {
      return { status: 'corrupt' };
    }
  }

  save(config: AppConfig): void {
    const content = serializeAppConfig(config);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    try {
      const previous = fs.readFileSync(this.filePath, 'utf8');
      parseAppConfig(previous);
      writeFileAtomic(this.backupPath, previous);
    } catch {
      // nessun precedente valido da salvare
    }
    writeFileAtomic(this.filePath, content);
  }
}
