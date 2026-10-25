import fs from 'node:fs';
import path from 'node:path';

export type EnvironmentOs = 'linux' | 'macos' | 'windows' | 'unknown';
export type EnvironmentShell = 'bash' | 'zsh' | 'fish' | 'sh' | 'pwsh' | 'powershell' | 'cmd' | 'unknown';

export interface DetectedLocalEnvironment { os: EnvironmentOs; shell: EnvironmentShell; }

export interface LocalShellCommand {
  file: string;
  args: string[];
  env: Record<string, string>;
}

function isExecutableFile(candidate: string): boolean {
  try {
    if (!fs.statSync(candidate).isFile()) {
      return false;
    }
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Detects from the exact resolved command; no probe process is needed for local sessions. */
export function detectLocalEnvironment(env: NodeJS.ProcessEnv, platform: NodeJS.Platform, isExecutable?: (candidate: string) => boolean): DetectedLocalEnvironment {
  const file = buildLocalShellCommand(env, platform, isExecutable).file;
  const base = path.basename(file).toLowerCase().replace(/\.exe$/, '');
  const shell: EnvironmentShell = ['bash', 'zsh', 'fish', 'sh', 'pwsh', 'powershell', 'cmd'].includes(base) ? base as EnvironmentShell : 'unknown';
  const os: EnvironmentOs = platform === 'linux' ? 'linux' : platform === 'darwin' ? 'macos' : platform === 'win32' ? 'windows' : 'unknown';
  return { os, shell };
}

/** Builds file+args (never a shell string) for the user's local shell. */
export function buildLocalShellCommand(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  isExecutable: (candidate: string) => boolean = isExecutableFile,
): LocalShellCommand {
  let file: string;
  if (platform === 'win32') {
    file = 'powershell.exe';
  } else {
    const preferred = env['SHELL'];
    file =
      preferred !== undefined && path.posix.isAbsolute(preferred) && isExecutable(preferred)
        ? preferred
        : '/bin/bash';
  }

  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      childEnv[key] = value;
    }
  }
  childEnv['TERM'] = 'xterm-256color';
  childEnv['COLORTERM'] = 'truecolor';
  return { file, args: [], env: childEnv };
}
