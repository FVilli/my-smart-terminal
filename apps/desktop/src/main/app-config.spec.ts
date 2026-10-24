import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppConfigStore, parseAppConfig, resolveConfigPath, serializeAppConfig, type AppConfig } from './app-config';

let root: string;
let file: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-config-'));
  file = path.join(root, 'config', 'config.md');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const full: AppConfig = {
  machineName: 'My Box',
  dataRepoPath: '/home/u/data repo',
  dataRepoRemote: 'git@github.com:u/data.git',
  aiProvider: 'openai-compatible',
  aiBaseUrl: 'https://llm.example.com/v1',
  aiModel: 'gpt-x',
  sttProvider: 'local',
  sttUseAiProvider: true,
  sttModel: 'whisper-1',
  sttBaseUrl: 'https://stt.example.com/v1',
  sttResponseFormat: 'verbose_json',
  sttLanguage: 'en',
  sttCommand: '/opt/stt/transcribe',
  syncDebounceMs: 500,
  syncMaxWaitMs: 5000,
  syncFetchIntervalMs: 60000,
  clipboardEnabled: true,
  terminalFont: 'cascadia',
};
const minimal: AppConfig = { machineName: 'host', dataRepoPath: '/data', aiProvider: 'none', sttProvider: 'none' };

describe('app config', () => {
  it('roundtrips full and minimal configs', () => {
    expect(parseAppConfig(serializeAppConfig(full))).toEqual(full);
    expect(parseAppConfig(serializeAppConfig(minimal))).toEqual(minimal);
    expect(serializeAppConfig(full)).toContain('stt_use_ai_provider: true');
    expect(serializeAppConfig(full)).toContain('schema_version: 1');
  });

  it.each([
    ['no frontmatter', 'machine_name: x'],
    ['wrong schema', '---\nschema_version: 2\nmachine_name: a\ndata_repo_path: /d\nai_provider: none\nstt_provider: none\n---\n'],
    ['unknown field', '---\nschema_version: 1\nmachine_name: a\ndata_repo_path: /d\nai_provider: none\nstt_provider: none\napi_key: sk-123\n---\n'],
    ['relative path', '---\nschema_version: 1\nmachine_name: a\ndata_repo_path: rel/d\nai_provider: none\nstt_provider: none\n---\n'],
    ['bad provider', '---\nschema_version: 1\nmachine_name: a\ndata_repo_path: /d\nai_provider: evil\nstt_provider: none\n---\n'],
    ['invalid terminal font', '---\nschema_version: 1\nmachine_name: a\ndata_repo_path: /d\nai_provider: none\nstt_provider: none\nterminal_font: "url(javascript:evil)"\n---\n'],
    ['url with credentials', '---\nschema_version: 1\nmachine_name: a\ndata_repo_path: /d\nai_provider: openai\nai_base_url: "https://u:p@x.com"\nstt_provider: none\n---\n'],
    ['bad ms', '---\nschema_version: 1\nmachine_name: a\ndata_repo_path: /d\nai_provider: none\nstt_provider: none\nsync_debounce_ms: -5\n---\n'],
    ['remote option', '---\nschema_version: 1\nmachine_name: a\ndata_repo_path: /d\ndata_repo_remote: "--upload-pack=x"\nai_provider: none\nstt_provider: none\n---\n'],
    ['unterminated', '---\nschema_version: 1\n'],
  ])('rejects %s', (_name, content) => {
    expect(() => parseAppConfig(content)).toThrow();
  });

  it('roundtrips and validates the local STT command', () => {
    expect(parseAppConfig(serializeAppConfig({ ...minimal, sttProvider: 'local', sttCommand: '/usr/local/bin/whisper-cli' }))).toMatchObject({
      sttProvider: 'local',
      sttCommand: '/usr/local/bin/whisper-cli',
    });
    expect(serializeAppConfig(full)).toContain('stt_command: "/opt/stt/transcribe"');
  });

  it.each([
    ['relative command', '---\nschema_version: 1\nmachine_name: a\ndata_repo_path: /d\nai_provider: none\nstt_provider: local\nstt_command: stt\n---\n'],
    ['command with newline', '---\nschema_version: 1\nmachine_name: a\ndata_repo_path: /d\nai_provider: none\nstt_provider: local\nstt_command: "/opt/stt\\nrm -rf /"\n---\n'],
    ['command not a string', '---\nschema_version: 1\nmachine_name: a\ndata_repo_path: /d\nai_provider: none\nstt_provider: local\nstt_command: 5\n---\n'],
    ['empty command', '---\nschema_version: 1\nmachine_name: a\ndata_repo_path: /d\nai_provider: none\nstt_provider: local\nstt_command: ""\n---\n'],
  ])('rejects %s', (_name, content) => {
    expect(() => parseAppConfig(content)).toThrow();
  });

  it('never serializes secrets-looking remotes with passwords', () => {
    expect(() => serializeAppConfig({ ...minimal, dataRepoRemote: 'https://user:pass@github.com/u/r.git' })).toThrow();
  });

  it('reports missing, saves atomically and keeps a backup of the previous valid file', () => {
    const store = new AppConfigStore(file);
    expect(store.load()).toEqual({ status: 'missing' });
    store.save(minimal);
    expect(store.load()).toEqual({ status: 'valid', config: minimal, restoredFromBackup: false });
    store.save(full);
    expect(fs.readdirSync(path.dirname(file)).sort()).toEqual(['config.md', 'config.md.bak']);
    expect(parseAppConfig(fs.readFileSync(`${file}.bak`, 'utf8'))).toEqual(minimal);
  });

  it('quarantines a corrupt file and restores the valid backup', () => {
    const store = new AppConfigStore(file);
    store.save(minimal);
    store.save(full);
    fs.writeFileSync(file, '---\nschema_version: 1\ngarbage\n---\n');
    expect(store.load()).toEqual({ status: 'valid', config: minimal, restoredFromBackup: true });
    expect(fs.readFileSync(`${file}.corrupt`, 'utf8')).toContain('garbage');
    expect(parseAppConfig(fs.readFileSync(file, 'utf8'))).toEqual(minimal);
  });

  it('reports corrupt without backup and never overwrites the corrupt content silently', () => {
    const store = new AppConfigStore(file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'not a config');
    expect(store.load()).toEqual({ status: 'corrupt' });
    expect(fs.readFileSync(`${file}.corrupt`, 'utf8')).toBe('not a config');
  });

  it('does not use an invalid backup', () => {
    const store = new AppConfigStore(file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'bad');
    fs.writeFileSync(`${file}.bak`, 'also bad');
    expect(store.load()).toEqual({ status: 'corrupt' });
  });

  it('resolves the path from SMART_TERMINAL_CONFIG_PATH or userData', () => {
    expect(resolveConfigPath('/ud', {})).toBe('/ud/config/config.md');
    expect(resolveConfigPath('/ud', { SMART_TERMINAL_CONFIG_PATH: '/x/c.md' })).toBe('/x/c.md');
  });
});
