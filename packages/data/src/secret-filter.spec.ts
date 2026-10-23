import { describe, expect, it } from 'vitest';
import { isSensitiveText } from './secret-filter';

describe('isSensitiveText', () => {
  it.each([
    '-----BEGIN OPENSSH PRIVATE KEY-----\nabc',
    '-----BEGIN PRIVATE KEY-----',
    'export PASSWORD=hunter2',
    'password: abc',
    'API_KEY=xyz',
    'api-key = xyz',
    'export GITHUB_TOKEN=ghp_abc',
    'client_secret: s3',
    'curl -H "Authorization: Bearer abcdefghijkl" https://x',
    'AKIAABCDEFGHIJKLMNOP',
    'git clone https://user:pw@github.com/a/b.git',
    'sshpass -p x ssh host',
    'echo pw | sudo -S ls',
    'sudo -S ls',
    'curl -u admin:pw https://x',
    'curl --user admin:pw https://x',
    'mysql --password=abc',
    'ssh-keygen -t ed25519 -N secret',
    'openssl enc -aes-256-cbc -pass pass:abc',
  ])('flags %j', (text) => {
    expect(isSensitiveText(text)).toBe(true);
  });

  it.each([
    'ls -la',
    "printf 'EDITOR_%s\\n' OK",
    'git status',
    'echo hello world',
    'curl https://example.com/path',
    'sudo apt update',
    'ssh-keygen -t ed25519',
    'https://github.com/a/b.git',
    'cat tokens.txt',
    '',
  ])('allows %j', (text) => {
    expect(isSensitiveText(text)).toBe(false);
  });
});
