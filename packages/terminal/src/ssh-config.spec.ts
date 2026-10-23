import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSshCommand, isValidSshAlias, listSshAliases } from './ssh-config';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'st-ssh-'));
  fs.mkdirSync(path.join(root, '.ssh', 'conf.d'), { recursive: true });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const write = (relative: string, content: string): void => fs.writeFileSync(path.join(root, relative), content);
const list = (): string[] => listSshAliases({ env: {}, homeDirectory: () => root });

describe('listSshAliases', () => {
  it('parses multiple hosts, comments, quotes, = separators and ignores wildcards and Match', () => {
    write(
      '.ssh/config',
      [
        '# comment',
        'Host alpha beta # trailing',
        '  HostName 1.2.3.4',
        'host="gamma"',
        'Host *',
        '  User x',
        'Host delta*  !negated ques?  "quoted-one"',
        'Match host foo',
        '  User y',
        'Host alpha dup',
        'Host "with space" bad;alias -leading ok.name_1',
      ].join('\n'),
    );
    expect(list()).toEqual(['alpha', 'beta', 'gamma', 'quoted-one', 'dup', 'ok.name_1']);
  });

  it('follows Include with globs, relative, absolute and ~ paths', () => {
    write('.ssh/config', ['Include conf.d/*.conf', `Include ${path.join(root, 'abs.conf')}`, 'Include ~/tilde.conf', 'Host main'].join('\n'));
    write('.ssh/conf.d/b.conf', 'Host from-b');
    write('.ssh/conf.d/a.conf', 'Host from-a');
    write('.ssh/conf.d/skip.txt', 'Host skipped');
    write('abs.conf', 'Host from-abs');
    write('tilde.conf', 'Host from-tilde');
    expect(list()).toEqual(['from-a', 'from-b', 'from-abs', 'from-tilde', 'main']);
  });

  it('limits include recursion to 10 levels and survives cycles', () => {
    write('.ssh/config', 'Include loop.conf\nHost top');
    write('.ssh/loop.conf', 'Host looped\nInclude loop.conf');
    expect(list()).toEqual(['looped', 'top']);
    for (let level = 0; level <= 12; level += 1) {
      write(`.ssh/l${level}.conf`, `Host level${level}\nInclude l${level + 1}.conf`);
    }
    write('.ssh/config', 'Include l0.conf');
    const aliases = list();
    expect(aliases[0]).toBe('level0');
    expect(aliases).toHaveLength(10);
  });

  it('honours SMART_TERMINAL_SSH_CONFIG and returns [] for a missing file', () => {
    write('custom', 'Host custom-host');
    expect(listSshAliases({ env: { SMART_TERMINAL_SSH_CONFIG: path.join(root, 'custom') }, homeDirectory: () => root })).toEqual(['custom-host']);
    expect(list()).toEqual([]);
  });
});

describe('buildSshCommand', () => {
  it('returns file + args array and inherits the agent socket without touching keys', () => {
    const command = buildSshCommand('prod', { SSH_AUTH_SOCK: '/tmp/agent', HOME: '/h' });
    expect(command.file).toBe('ssh');
    expect(command.args).toEqual(['prod']);
    expect(command.env['SSH_AUTH_SOCK']).toBe('/tmp/agent');
    expect(command.env['TERM']).toBe('xterm-256color');
  });

  it('uses SMART_TERMINAL_SSH_BINARY or the explicit binary', () => {
    expect(buildSshCommand('a', { SMART_TERMINAL_SSH_BINARY: '/x/fake' }).file).toBe('/x/fake');
    expect(buildSshCommand('a', { SMART_TERMINAL_SSH_BINARY: '/x/fake' }, '/y/other').file).toBe('/y/other');
  });

  it.each(['', '-oProxyCommand=evil', '-a', 'a b', 'a;b', 'a$(x)', 'a|b', 'a\nb', 'a`b`', 'a&b', 'a/b', "a'b", 'a"b', 'é'])('rejects injection alias %j', (alias) => {
    expect(isValidSshAlias(alias)).toBe(false);
    expect(() => buildSshCommand(alias, {})).toThrow('SSH_INVALID_ALIAS');
  });
});
