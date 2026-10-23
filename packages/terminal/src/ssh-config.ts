import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Maximum depth of nested `Include` directives. */
export const SSH_MAX_INCLUDE_DEPTH = 10;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILES = 200;
const MAX_ALIASES = 1000;
const ALIAS_PATTERN = /^[A-Za-z0-9._-]+$/;

export function isValidSshAlias(alias: unknown): alias is string {
  return typeof alias === 'string' && alias.length > 0 && alias.length <= 255 && !alias.startsWith('-') && ALIAS_PATTERN.test(alias);
}

/** Splits a line into tokens: spaces or `=` as separators, quoted values, and `#` comments outside quotes. */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inToken = false;
  let quoted = false;
  let index = 0;
  const flush = (): void => {
    if (inToken) {
      tokens.push(current);
    }
    current = '';
    inToken = false;
  };
  for (; index < line.length; index += 1) {
    const char = line[index] as string;
    if (quoted) {
      if (char === '"') {
        quoted = false;
      } else if (char === '\\' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '#' && !inToken) {
      break;
    }
    if (char === '"') {
      quoted = true;
      inToken = true;
    } else if (char === ' ' || char === '\t' || char === '\r') {
      flush();
    } else if (char === '=' && tokens.length === 0) {
      flush();
    } else {
      current += char;
      inToken = true;
    }
  }
  flush();
  return tokens;
}

function expandHome(value: string, home: string): string {
  if (value === '~') {
    return home;
  }
  return value.startsWith('~/') ? path.join(home, value.slice(2)) : value;
}

function globToRegExp(pattern: string): RegExp {
  let source = '';
  for (const char of pattern) {
    source += char === '*' ? '[^/]*' : char === '?' ? '[^/]' : char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

/** Expands a path with `*`/`?` wildcards (including in intermediate directories); results are lexically sorted. */
function expandGlob(pattern: string): string[] {
  if (!/[*?]/.test(pattern)) {
    return [pattern];
  }
  const segments = pattern.split('/');
  let candidates = [segments[0] === '' ? '/' : (segments[0] as string)];
  for (const segment of segments.slice(1)) {
    const next: string[] = [];
    for (const base of candidates) {
      if (!/[*?]/.test(segment)) {
        next.push(path.join(base, segment));
        continue;
      }
      let names: string[];
      try {
        names = fs.readdirSync(base);
      } catch {
        continue;
      }
      const matcher = globToRegExp(segment);
      for (const name of names.sort()) {
        if (matcher.test(name) && !name.startsWith('.')) {
          next.push(path.join(base, name));
        }
      }
    }
    candidates = next;
  }
  return candidates;
}

interface ParseState {
  aliases: string[];
  seen: Set<string>;
  filesRead: number;
  home: string;
  sshDir: string;
}

function addAlias(state: ParseState, token: string): void {
  if (/[*?!]/.test(token) || !isValidSshAlias(token) || state.seen.has(token) || state.aliases.length >= MAX_ALIASES) {
    return;
  }
  state.seen.add(token);
  state.aliases.push(token);
}

function readConfigFile(file: string, depth: number, state: ParseState): void {
  if (depth > SSH_MAX_INCLUDE_DEPTH || state.filesRead >= MAX_FILES) {
    return;
  }
  let content: string;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) {
      return;
    }
    content = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  state.filesRead += 1;
  for (const line of content.split('\n')) {
    const [keyword, ...values] = tokenize(line);
    switch (keyword?.toLowerCase()) {
      case 'host':
        for (const value of values) {
          addAlias(state, value);
        }
        break;
      case 'include':
        for (const value of values) {
          const expanded = expandHome(value, state.home);
          const absolute = path.isAbsolute(expanded) ? expanded : path.join(state.sshDir, expanded);
          for (const included of expandGlob(absolute)) {
            readConfigFile(included, depth + 1, state);
          }
        }
        break;
      default:
        // `Match` and all other directives do not define aliases.
        break;
    }
  }
}

export interface SshConfigLocation {
  env?: NodeJS.ProcessEnv;
  homeDirectory?: () => string;
}

/** Selectable `Host` aliases from `~/.ssh/config` (or `SMART_TERMINAL_SSH_CONFIG`); read-only, never throws to the caller. */
export function listSshAliases(location: SshConfigLocation = {}): string[] {
  const env = location.env ?? process.env;
  const home = (location.homeDirectory ?? os.homedir)();
  const override = env['SMART_TERMINAL_SSH_CONFIG'];
  const root = override !== undefined && override.length > 0 ? path.resolve(override) : path.join(home, '.ssh', 'config');
  const state: ParseState = { aliases: [], seen: new Set(), filesRead: 0, home, sshDir: path.dirname(root) };
  readConfigFile(root, 0, state);
  return state.aliases;
}

export interface SshCommand {
  file: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * `ssh <alias>` command as file+args (never a shell string). The environment is inherited (including `SSH_AUTH_SOCK`);
 * no private key is read or copied: authentication remains with ssh/agent.
 */
export function buildSshCommand(alias: string, env: NodeJS.ProcessEnv, sshBinary?: string): SshCommand {
  if (!isValidSshAlias(alias)) {
    throw new Error('SSH_INVALID_ALIAS');
  }
  const override = env['SMART_TERMINAL_SSH_BINARY'];
  const file = sshBinary ?? (override !== undefined && override.length > 0 ? override : 'ssh');
  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      childEnv[key] = value;
    }
  }
  childEnv['TERM'] = 'xterm-256color';
  childEnv['COLORTERM'] = 'truecolor';
  return { file, args: [alias], env: childEnv };
}
