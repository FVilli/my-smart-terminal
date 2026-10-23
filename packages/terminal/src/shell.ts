import fs from 'node:fs';
import path from 'node:path';

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

/** Costruisce file+args (mai una stringa shell) per la shell locale dell'utente. */
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
