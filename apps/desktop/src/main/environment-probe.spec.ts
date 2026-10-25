import { describe, expect, it, vi } from 'vitest';
import { parseProbeOutput, probeSshEnvironment, sshProbeArgs } from './environment-probe';

describe('ssh environment probe', () => {
  it('maps OS and shell names from the probe output', () => {
    expect(parseProbeOutput('Linux;/bin/zsh\n')).toEqual({ os: 'linux', shell: 'zsh' });
    expect(parseProbeOutput('Darwin;/usr/local/bin/fish')).toEqual({ os: 'macos', shell: 'fish' });
    expect(parseProbeOutput('MINGW64_NT-10.0;C:\\Program Files\\PowerShell\\7\\pwsh.exe')).toEqual({ os: 'windows', shell: 'pwsh' });
    expect(parseProbeOutput('SunOS;/bin/sh')).toEqual({ os: 'unknown', shell: 'sh' });
    expect(parseProbeOutput('')).toBeUndefined();
    expect(parseProbeOutput('   ;   ')).toBeUndefined();
  });

  it('builds a non-interactive probe command', () => {
    const args = sshProbeArgs('server');
    expect(args).toContain('-o');
    expect(args).toContain('BatchMode=yes');
    expect(args).toContain('ConnectTimeout=3');
    expect(args.at(-2)).toBe('server');
  });

  it('returns a detected environment with source and timestamp', async () => {
    const runner = vi.fn(async () => 'Linux;/bin/bash');
    const env = await probeSshEnvironment({ alias: 'server', runner, clock: () => new Date('2026-01-01T10:00:00+00:00') });
    expect(runner).toHaveBeenCalledWith(sshProbeArgs('server'), 5000);
    expect(env).toEqual({ os: 'linux', shell: 'bash', source: 'ssh-probe', detectedAt: '2026-01-01T10:00:00.000Z' });
  });

  it('degrades to unknown on failure, timeout or invalid alias and never throws', async () => {
    const failing = vi.fn(async () => {
      throw new Error('timeout');
    });
    await expect(probeSshEnvironment({ alias: 'server', runner: failing })).resolves.toEqual({ os: 'unknown', shell: 'unknown', source: 'unknown' });
    const notCalled = vi.fn(async () => 'Linux;/bin/bash');
    await expect(probeSshEnvironment({ alias: '../escape', runner: notCalled })).resolves.toMatchObject({ source: 'unknown' });
    expect(notCalled).not.toHaveBeenCalled();
    await expect(probeSshEnvironment({ alias: 'server', runner: vi.fn(async () => 'nonsense') })).resolves.toMatchObject({ os: 'unknown', shell: 'unknown' });
  });
});
