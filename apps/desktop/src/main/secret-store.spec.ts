import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SecretStore, type SafeStorageLike } from './secret-store';

let dir: string;
beforeEach(() => {
  dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'st-secrets-')), 'secrets');
});
afterEach(() => fs.rmSync(path.dirname(dir), { recursive: true, force: true }));

const fake = (available: boolean, backend?: string): SafeStorageLike => ({
  isEncryptionAvailable: () => available,
  encryptString: (text) => Buffer.from(`enc:${Buffer.from(text).toString('hex')}`),
  decryptString: (buffer) => Buffer.from(buffer.toString().slice(4), 'hex').toString(),
  ...(backend !== undefined && { getSelectedStorageBackend: () => backend }),
});

describe('SecretStore', () => {
  it('persists encrypted tokens with 0600 and no plaintext when the backend is secure', () => {
    const store = new SecretStore(dir, fake(true, 'gnome_libsecret'));
    expect(store.set('ai:anthropic', 'sk-very-secret')).toEqual({ persisted: true });
    const file = path.join(dir, 'ai-anthropic.json');
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.readFileSync(file, 'utf8')).not.toContain('sk-very-secret');
    expect(fs.readdirSync(dir)).toEqual(['ai-anthropic.json']);
    expect(new SecretStore(dir, fake(true, 'gnome_libsecret')).get('ai:anthropic')).toBe('sk-very-secret');
    expect(store.keys()).toEqual(['ai:anthropic']);
    expect(store.has('ai:anthropic')).toBe(true);
  });

  it('treats basic_text, unknown backend and unavailable encryption as insecure: memory only plus warning', () => {
    for (const safe of [fake(true, 'basic_text'), fake(true, 'unknown'), fake(false), fake(true, 'basic_text')]) {
      const store = new SecretStore(dir, safe);
      expect(store.isSecure()).toBe(false);
      const result = store.set('stt:cloud', 'tok-123');
      expect(result.persisted).toBe(false);
      expect(result.warning).toMatch(/keychain/i);
      expect(fs.existsSync(dir) ? fs.readdirSync(dir) : []).toEqual([]);
      expect(store.get('stt:cloud')).toBe('tok-123');
      expect(new SecretStore(dir, safe).get('stt:cloud')).toBeUndefined();
    }
  });

  it('accepts platforms without a backend selector (macOS/Windows)', () => {
    expect(new SecretStore(dir, fake(true)).isSecure()).toBe(true);
  });

  it('deletes tokens from memory and disk (logout) and replaces stale files when insecure', () => {
    const secure = new SecretStore(dir, fake(true, 'kwallet5'));
    secure.set('ai:openai', 'a');
    secure.delete('ai:openai');
    expect(secure.has('ai:openai')).toBe(false);
    expect(secure.get('ai:openai')).toBeUndefined();
    secure.set('ai:openai', 'a');
    const insecure = new SecretStore(dir, fake(true, 'basic_text'));
    insecure.set('ai:openai', 'b');
    expect(fs.readdirSync(dir)).toEqual([]);
    insecure.delete('ai:openai');
    expect(insecure.keys()).toEqual([]);
  });

  it('rejects invalid keys and tokens', () => {
    const store = new SecretStore(dir, fake(true));
    expect(() => store.set('../evil', 'x')).toThrow('SECRET_INVALID');
    expect(() => store.set('ai:openai', '')).toThrow('SECRET_INVALID');
    expect(() => store.set('ai:openai', 'a\nb')).toThrow('SECRET_INVALID');
    expect(() => store.delete('x')).toThrow('SECRET_INVALID');
    expect(store.get('ai:../x')).toBeUndefined();
  });

  it('falls back to memory when encryption throws', () => {
    const store = new SecretStore(dir, { ...fake(true), encryptString: () => { throw new Error('x'); } });
    expect(store.set('ai:openai', 't').persisted).toBe(false);
    expect(store.get('ai:openai')).toBe('t');
  });
});
