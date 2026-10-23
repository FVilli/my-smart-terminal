import { GitEngine } from '@smart-terminal/sync';
import { formatIsoWithOffset, normalizeMachine } from '@smart-terminal/data';

export interface InstanceRegistrationOptions {
  dataRepoPath: string;
  remote?: string;
  machine: string;
  installationId: string;
  installationCreatedAt: string;
  appVersion: string;
  platform: string;
  arch: string;
  clock?: () => Date;
}

export interface InstanceRegistrationResult {
  ok: boolean;
  committed: boolean;
  pushed: boolean;
  localOnly: boolean;
  state: 'synced' | 'offline' | 'error';
  commit?: string;
  path?: string;
  error?: string;
}

const INSTANCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Writes a non-sensitive installation registration and proves commit/push on the configured repository. */
export class InstanceRegistrar {
  private readonly clock: () => Date;

  constructor(private readonly options: InstanceRegistrationOptions) {
    this.clock = options.clock ?? (() => new Date());
  }

  async register(): Promise<InstanceRegistrationResult> {
    const machine = normalizeMachine(this.options.machine);
    if (!INSTANCE_ID.test(this.options.installationId)) {
      return { ok: false, committed: false, pushed: false, localOnly: this.options.remote === undefined, state: 'error', error: 'Invalid installation id' };
    }
    const relativePath = `instances/${machine}-${this.options.installationId}.md`;
    const now = formatIsoWithOffset(this.clock());
    const content = [
      '---',
      'schema_version: 1',
      `instance_id: "${this.options.installationId}"`,
      `machine: "${machine}"`,
      `app_version: "${this.options.appVersion}"`,
      `platform: "${this.options.platform}"`,
      `arch: "${this.options.arch}"`,
      `created_at: "${this.options.installationCreatedAt}"`,
      `updated_at: "${now}"`,
      '---',
      '',
      '# Smart Terminal instance',
      '',
      'This file is written by the setup verification. It contains no credentials or personal paths.',
      '',
    ].join('\n');

    const engine = new GitEngine({
      repoPath: this.options.dataRepoPath,
      machine,
      ...(this.options.remote !== undefined && this.options.remote.length > 0 ? { remote: this.options.remote } : {}),
    });
    try {
      const result = await engine.testRemote(relativePath, content);
      return {
        ok: result.state !== 'error' && result.state !== 'offline' && (result.pushed || result.localOnly),
        committed: result.committed,
        pushed: result.pushed,
        localOnly: result.localOnly,
        state: result.state === 'offline' ? 'offline' : result.state === 'error' ? 'error' : 'synced',
        ...(result.commit !== undefined ? { commit: result.commit } : {}),
        path: relativePath,
        ...(result.error !== undefined ? { error: result.error } : {}),
      };
    } catch (error) {
      return {
        ok: false,
        committed: false,
        pushed: false,
        localOnly: this.options.remote === undefined,
        state: 'error',
        path: relativePath,
        error: error instanceof Error ? error.message : 'Repository verification failed',
      };
    }
  }
}
