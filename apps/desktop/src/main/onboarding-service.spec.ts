import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OnboardingConfig } from '@smart-terminal/contracts';
import { AppConfigStore, parseAppConfig, type ConfigLoadResult } from './app-config';
import { resolveGitRemote } from './coordinator-runtime';
import { DataRuntime, resolveDataPaths } from './data-runtime';
import { OnboardingService } from './onboarding-service';
import { SecretStore, type SafeStorageLike } from './secret-store';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-onboarding-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const safe = (backend: string): SafeStorageLike => ({
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from(text, 'utf8').reverse(),
  decryptString: (buffer) => Buffer.from(buffer).reverse().toString('utf8'),
  getSelectedStorageBackend: () => backend,
});

function setup(options: { backend?: string; env?: NodeJS.ProcessEnv } = {}) {
  const userDataPath = path.join(root, 'ud');
  const env = options.env ?? {};
  const store = new AppConfigStore(path.join(userDataPath, 'config', 'config.md'));
  const initialLoad: ConfigLoadResult = store.load();
  const secrets = new SecretStore(path.join(userDataPath, 'secrets'), safe(options.backend ?? 'gnome_libsecret'));
  const hostname = () => 'Host.Local';
  const config = initialLoad.status === 'valid' ? initialLoad.config : undefined;
  const service = new OnboardingService({
    userDataPath,
    env,
    hostname,
    store,
    secrets,
    runningPaths: resolveDataPaths(userDataPath, env, hostname, config),
    runningRemote: config?.dataRepoRemote,
    initialLoad,
    installation: { installationId: '00000000-0000-4000-8000-000000000001', createdAt: '2026-10-23T00:00:00.000Z' },
    appVersion: '1.0.0',
    platform: 'linux',
    arch: 'x64',
  });
  return { service, store, secrets, userDataPath, hostname };
}

const valid = (overrides: Partial<OnboardingConfig> = {}): OnboardingConfig => ({
  machineName: 'Work Laptop',
  dataRepoPath: path.join(root, 'repo'),
  aiProvider: 'anthropic',
  sttProvider: 'none',
  ...overrides,
});

describe('OnboardingService', () => {
  it('requires the wizard when config is missing and offers defaults', () => {
    const { service, userDataPath } = setup();
    expect(service.state()).toMatchObject({
      required: true,
      reason: 'missing',
      config: { machineName: 'host.local', dataRepoPath: path.join(userDataPath, 'data'), aiProvider: 'none', sttProvider: 'none' },
    });
  });

  it('does not require the wizard under an env repo override', () => {
    expect(setup({ env: { SMART_TERMINAL_DATA_REPO: '/tmp/x' } }).service.state()).toMatchObject({ required: false, reason: 'env-override' });
  });

  it('saves config without secrets, keeps the token in the secret store and flags restart', () => {
    const { service, store, secrets, userDataPath } = setup();
    const result = service.save({ config: valid({ dataRepoRemote: 'git@github.com:u/d.git', aiBaseUrl: 'https://api.example.com' }), aiToken: 'sk-top-secret' });
    expect(result).toEqual({ ok: true, errors: {}, restartRequired: true, warnings: [] });
    const content = fs.readFileSync(store.filePath, 'utf8');
    expect(content).not.toContain('sk-top-secret');
    expect(parseAppConfig(content)).toMatchObject({ machineName: 'Work Laptop', dataRepoPath: path.join(root, 'repo'), aiProvider: 'anthropic' });
    expect(fs.statSync(path.join(root, 'repo')).isDirectory()).toBe(true);
    expect(secrets.get('ai:anthropic')).toBe('sk-top-secret');
    const everything = fs.readdirSync(userDataPath, { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
    for (const entry of everything) {
      expect(fs.readFileSync(path.join(entry.parentPath, entry.name), 'utf8')).not.toContain('sk-top-secret');
    }
    expect(service.state()).toMatchObject({ required: false, reason: 'valid', storedSecrets: ['ai:anthropic'] });
    expect(JSON.stringify(service.state())).not.toContain('sk-top-secret');
  });

  it('returns a keychain warning and persists nothing when the backend is basic_text', () => {
    const { service, secrets, userDataPath } = setup({ backend: 'basic_text' });
    const result = service.save({ config: valid(), aiToken: 'sk-mem' });
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(secrets.get('ai:anthropic')).toBe('sk-mem');
    expect(fs.existsSync(path.join(userDataPath, 'secrets'))).toBe(false);
    expect(service.state().secureStorage).toBe(false);
  });

  it('works with every optional step skipped and without a token', () => {
    const { service } = setup();
    const result = service.save({ config: valid({ aiProvider: 'none' }) });
    expect(result).toMatchObject({ ok: true, warnings: [] });
  });

  it('skip writes default config without restart and hides the wizard', () => {
    const { service, store } = setup();
    expect(service.skip()).toMatchObject({ ok: true, restartRequired: false });
    expect(parseAppConfig(fs.readFileSync(store.filePath, 'utf8'))).toMatchObject({ machineName: 'host.local', aiProvider: 'none', sttProvider: 'none' });
    expect(service.state().required).toBe(false);
  });

  it('returns sanitized field errors for invalid input and writes nothing', () => {
    const { service, store } = setup();
    const result = service.save({
      config: { machineName: '', dataRepoPath: 'relative/path', aiProvider: 'evil', sttProvider: 'none', aiBaseUrl: 'ftp://x', dataRepoRemote: '--x' } as unknown as OnboardingConfig,
      aiToken: 'a\nb',
    });
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(['aiBaseUrl', 'aiProvider', 'aiToken', 'dataRepoPath', 'dataRepoRemote', 'machineName']);
    expect(JSON.stringify(result)).not.toContain('relative/path');
    expect(fs.existsSync(store.filePath)).toBe(false);
  });

  it('rejects an unwritable repo path and a file as repo path', () => {
    const { service } = setup();
    fs.writeFileSync(path.join(root, 'file'), 'x');
    expect(service.validate(valid({ dataRepoPath: path.join(root, 'file') })).errors).toHaveProperty('dataRepoPath');
    expect(service.validate(valid({ dataRepoPath: path.join(root, 'file', 'child') })).errors).toHaveProperty('dataRepoPath');
    expect(service.validate(valid({ dataRepoPath: path.join(root, 'new', 'deep') })).ok).toBe(true);
  });

  it('reports no restart when repo, machine and remote are unchanged', () => {
    const first = setup();
    first.service.save({ config: valid() });
    const second = setup();
    expect(second.service.state().required).toBe(false);
    expect(second.service.save({ config: valid({ aiProvider: 'openai' }) })).toMatchObject({ ok: true, restartRequired: false });
  });

  it('saves the local STT command only for provider local and drops it otherwise', () => {
    const { service, store } = setup();
    expect(service.save({ config: valid({ sttProvider: 'local', sttCommand: path.join(root, 'stt') }) })).toMatchObject({ ok: true });
    expect(parseAppConfig(fs.readFileSync(store.filePath, 'utf8'))).toMatchObject({ sttProvider: 'local', sttCommand: path.join(root, 'stt') });
    expect(service.state().config).toMatchObject({ sttProvider: 'local', sttCommand: path.join(root, 'stt') });
    expect(service.save({ config: valid({ sttProvider: 'none', sttCommand: path.join(root, 'stt') }) })).toMatchObject({ ok: true });
    expect(parseAppConfig(fs.readFileSync(store.filePath, 'utf8')).sttCommand).toBeUndefined();
  });

  it('rejects a relative or non-string STT command with a sanitized error', () => {
    const { service, store } = setup();
    expect(service.validate(valid({ sttProvider: 'local', sttCommand: 'stt' })).errors).toHaveProperty('sttCommand');
    expect(service.validate(valid({ sttProvider: 'local', sttCommand: '/opt/stt\nrm -rf /' })).errors).toHaveProperty('sttCommand');
    expect(service.validate(valid({ sttProvider: 'local', sttCommand: 5 as unknown as string })).errors).toHaveProperty('sttCommand');
    expect(service.validate(valid({ sttProvider: 'local' })).ok).toBe(true);
    expect(service.save({ config: valid({ sttProvider: 'local', sttCommand: 'relativo' }) }).ok).toBe(false);
    expect(fs.existsSync(store.filePath)).toBe(false);
  });

  it('logout revokes a token', () => {
    const { service, secrets } = setup();
    service.save({ config: valid(), aiToken: 'tok' });
    expect(service.logout('ai:anthropic')).toEqual({ secureStorage: true, storedSecrets: [] });
    expect(secrets.get('ai:anthropic')).toBeUndefined();
    expect(() => service.logout('bad')).toThrow();
  });

  it('applies saved config to DataRuntime with env > config > default and without mutating process.env', () => {
    const { service, store, userDataPath } = setup();
    service.save({ config: valid() });
    const loaded = store.load();
    if (loaded.status !== 'valid') throw new Error('config not valid');
    const before = JSON.stringify(process.env);
    const fromConfig = new DataRuntime({ userDataPath, env: {}, config: loaded.config });
    expect(fromConfig.dataRepoPath).toBe(path.join(root, 'repo'));
    expect(fromConfig.machine).toBe('work-laptop');
    const envWins = new DataRuntime({ userDataPath, env: { SMART_TERMINAL_DATA_REPO: path.join(root, 'env-repo'), SMART_TERMINAL_MACHINE: 'ENV' }, config: loaded.config });
    expect(envWins.dataRepoPath).toBe(path.join(root, 'env-repo'));
    expect(envWins.machine).toBe('env');
    expect(new DataRuntime({ userDataPath, env: {}, hostname: () => 'H' }).dataRepoPath).toBe(path.join(userDataPath, 'data'));
    expect(JSON.stringify(process.env)).toBe(before);
  });

  it('resolves the git remote with env > config', () => {
    const config = { machineName: 'm', dataRepoPath: '/d', dataRepoRemote: 'git@h:cfg.git', aiProvider: 'none' as const, sttProvider: 'none' as const };
    expect(resolveGitRemote({}, config)).toBe('git@h:cfg.git');
    expect(resolveGitRemote({ SMART_TERMINAL_GIT_REMOTE: 'git@h:env.git' }, config)).toBe('git@h:env.git');
    expect(resolveGitRemote({}, undefined)).toBeUndefined();
  });
});
