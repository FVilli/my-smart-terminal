import fs from 'node:fs';
import path from 'node:path';
import { SECRET_TOKEN_MAX_LENGTH } from '@smart-terminal/contracts';

/** Subset of Electron `safeStorage` (injectable in tests). */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
  /** Linux only: `basic_text` means encryption with a fixed key and is therefore insecure. */
  getSelectedStorageBackend?(): string;
}

export interface SecretSetResult {
  /** The token was written to encrypted disk. */
  persisted: boolean;
  /** Present when the token remains in memory only. */
  warning?: string;
}

export const SECRET_UNSECURE_WARNING =
  'System keychain unavailable: the token will stay in memory only and must be entered again at next launch.';

const KEY_PATTERN = /^(ai|stt):[a-z][a-z-]{0,31}$/;

export function isValidSecretKey(key: unknown): key is string {
  return typeof key === 'string' && KEY_PATTERN.test(key);
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
}

export function isValidSecretToken(token: unknown): token is string {
  return typeof token === 'string' && token.length > 0 && token.length <= SECRET_TOKEN_MAX_LENGTH && !hasControlCharacters(token);
}

function writePrivateFileAtomic(file: string, content: string): void {
  const temporary = `${file}.${process.pid}.${Date.now().toString(36)}.tmp`;
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

/**
 * Tokens encrypted with `safeStorage` in `<dir>/<key>.json` (0600, atomic write). If secure encryption is
 * unavailable, nothing is written to disk: the token remains in memory for the session.
 */
export class SecretStore {
  private readonly memory = new Map<string, string>();

  constructor(
    private readonly directory: string,
    private readonly safeStorage: SafeStorageLike,
  ) {}

  /** Encryption available and backend is not `basic_text`/unknown. */
  isSecure(): boolean {
    try {
      if (!this.safeStorage.isEncryptionAvailable()) {
        return false;
      }
      const backend = this.safeStorage.getSelectedStorageBackend?.();
      return backend === undefined || backend === 'not_used' || !['basic_text', 'unknown'].includes(backend);
    } catch {
      return false;
    }
  }

  set(key: string, token: string): SecretSetResult {
    if (!isValidSecretKey(key) || !isValidSecretToken(token)) {
      throw new Error('SECRET_INVALID');
    }
    if (!this.isSecure()) {
      this.memory.set(key, token);
      this.removeFile(key);
      return { persisted: false, warning: SECRET_UNSECURE_WARNING };
    }
    let encrypted: Buffer;
    try {
      encrypted = this.safeStorage.encryptString(token);
    } catch {
      this.memory.set(key, token);
      return { persisted: false, warning: SECRET_UNSECURE_WARNING };
    }
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const file = this.fileFor(key);
    writePrivateFileAtomic(file, `${JSON.stringify({ schema_version: 1, ciphertext: encrypted.toString('base64') })}\n`);
    this.memory.delete(key);
    return { persisted: true };
  }

  /** For internal main-process use only (future AI/STT adapters); not exposed through IPC. */
  get(key: string): string | undefined {
    if (!isValidSecretKey(key)) {
      return undefined;
    }
    const cached = this.memory.get(key);
    if (cached !== undefined) {
      return cached;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.fileFor(key), 'utf8')) as { ciphertext?: unknown };
      if (typeof parsed.ciphertext !== 'string' || !this.isSecure()) {
        return undefined;
      }
      return this.safeStorage.decryptString(Buffer.from(parsed.ciphertext, 'base64'));
    } catch {
      return undefined;
    }
  }

  has(key: string): boolean {
    return isValidSecretKey(key) && (this.memory.has(key) || fs.existsSync(this.fileFor(key)));
  }

  /** Revocation: removes the token from memory and disk. */
  delete(key: string): void {
    if (!isValidSecretKey(key)) {
      throw new Error('SECRET_INVALID');
    }
    this.memory.delete(key);
    this.removeFile(key);
  }

  keys(): string[] {
    const keys = new Set(this.memory.keys());
    try {
      for (const name of fs.readdirSync(this.directory)) {
        const match = /^(ai|stt)-([a-z][a-z-]{0,31})\.json$/.exec(name);
        if (match !== null) {
          keys.add(`${match[1]}:${match[2]}`);
        }
      }
    } catch {
      // directory missing: no secret persisted
    }
    return [...keys].sort();
  }

  private fileFor(key: string): string {
    return path.join(this.directory, `${key.replace(':', '-')}.json`);
  }

  private removeFile(key: string): void {
    fs.rmSync(this.fileFor(key), { force: true });
  }
}
