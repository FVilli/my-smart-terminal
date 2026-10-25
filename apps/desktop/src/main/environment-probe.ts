import { spawn } from 'node:child_process';
import type { SessionEnvironment, SessionOs, SessionShell } from '@smart-terminal/contracts';
import { isValidSshAlias } from '@smart-terminal/terminal';

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 4096;
/** Read-only probe: prints OS name and login shell, separated by `;`. */
const PROBE_SCRIPT = 'printf "%s;%s" "$(uname -s)" "$SHELL"';

const UNKNOWN: SessionEnvironment = { os: 'unknown', shell: 'unknown', source: 'unknown' };

/** Executes one probe command and resolves its stdout; rejects on timeout, non-zero exit or spawn error. */
export type SshProbeRunner = (args: string[], timeoutMs: number) => Promise<string>;

export interface ProbeSshEnvironmentOptions {
  alias: string;
  sshBinary?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /** Test seam: replaces the real ssh process. */
  runner?: SshProbeRunner;
  clock?: () => Date;
}

/** Arguments for the probe. The alias is validated by `probeSshEnvironment` before this is built. */
export function sshProbeArgs(alias: string): string[] {
  return ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=3', alias, PROBE_SCRIPT];
}

function mapOs(raw: string | undefined): SessionOs {
  if (raw === undefined) return 'unknown';
  if (/^linux/i.test(raw)) return 'linux';
  if (/^darwin/i.test(raw)) return 'macos';
  if (/mingw|msys|cygwin|windows/i.test(raw)) return 'windows';
  return 'unknown';
}

function mapShell(raw: string | undefined): SessionShell {
  if (raw === undefined) return 'unknown';
  const base = raw.split(/[\\/]/).pop()?.toLowerCase().replace(/\.exe$/, '') ?? '';
  const shells: SessionShell[] = ['bash', 'zsh', 'fish', 'sh', 'pwsh', 'powershell', 'cmd'];
  return (shells as string[]).includes(base) ? (base as SessionShell) : 'unknown';
}

/** Parses `uname -s;SHELL` output; returns undefined when the output is unusable. */
export function parseProbeOutput(stdout: string): { os: SessionOs; shell: SessionShell } | undefined {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return undefined;
  const [osRaw, shellRaw] = trimmed.split(';');
  const os = mapOs(osRaw?.trim());
  const shell = mapShell(shellRaw?.trim());
  return os === 'unknown' && shell === 'unknown' ? undefined : { os, shell };
}

function spawnRunner(sshBinary: string, env: NodeJS.ProcessEnv): SshProbeRunner {
  return (args, timeoutMs) =>
    new Promise<string>((resolve, reject) => {
      const child = spawn(sshBinary, args, { stdio: ['ignore', 'pipe', 'ignore'], env, windowsHide: true });
      let out = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('timeout'));
      }, timeoutMs);
      child.stdout.on('data', (chunk: Buffer) => {
        if (out.length < MAX_OUTPUT_BYTES) out += chunk.toString('utf8');
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(out);
        else reject(new Error(`exit ${code ?? 'unknown'}`));
      });
    });
}

/**
 * Best-effort SSH environment probe. Runs outside the interactive PTY (BatchMode stdin, hard
 * timeout) so it can never steal input or output; any failure resolves to `unknown` and the
 * session stays fully usable.
 */
export async function probeSshEnvironment(options: ProbeSshEnvironmentOptions): Promise<SessionEnvironment> {
  if (!isValidSshAlias(options.alias)) return { ...UNKNOWN };
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const env = options.env ?? process.env;
  const runner = options.runner ?? spawnRunner(options.sshBinary ?? env['SMART_TERMINAL_SSH_BINARY'] ?? 'ssh', env);
  try {
    const parsed = parseProbeOutput(await runner(sshProbeArgs(options.alias), timeoutMs));
    if (parsed === undefined) return { ...UNKNOWN };
    return { ...parsed, source: 'ssh-probe', detectedAt: (options.clock ?? (() => new Date()))().toISOString() };
  } catch {
    return { ...UNKNOWN };
  }
}
