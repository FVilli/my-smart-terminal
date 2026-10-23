import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import type { AllocateSessionRequest, AllocatedSession, SessionIdAllocator } from '@smart-terminal/data';
import { MAX_LINE_BYTES, PROTOCOL_VERSION, type RpcRequest, type RpcResponse } from './protocol';
import { coordinatorEndpoint, tokenPath } from './server';

export type CoordinatorClientErrorCode = 'COORDINATOR_UNAVAILABLE' | 'COORDINATOR_ERROR';

export class CoordinatorClientError extends Error {
  constructor(
    readonly code: CoordinatorClientErrorCode,
    /** RPC code returned by the primary, if present. */
    readonly remoteCode?: string,
  ) {
    super(remoteCode === undefined ? code : `${code}: ${remoteCode}`);
    this.name = 'CoordinatorClientError';
  }
}

export interface CoordinatorRequester {
  request<T = unknown>(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<T>;
}

export interface CoordinatorClientOptions {
  userDataPath: string;
  connectTimeoutMs?: number;
  platform?: NodeJS.Platform;
}

/**
 * RPC client: each request opens a connection (rereads the token and endpoint), so
 * a new primary after a takeover is reached without reconnection state.
 */
export class CoordinatorClient implements CoordinatorRequester {
  private readonly endpoint: string;
  private readonly tokenFile: string;
  private readonly connectTimeoutMs: number;

  constructor(options: CoordinatorClientOptions) {
    this.endpoint = coordinatorEndpoint(options.userDataPath, options.platform);
    this.tokenFile = tokenPath(options.userDataPath);
    this.connectTimeoutMs = options.connectTimeoutMs ?? 2000;
  }

  async request<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 5000): Promise<T> {
    let token: string;
    try {
      token = fs.readFileSync(this.tokenFile, 'utf8').trim();
    } catch {
      throw new CoordinatorClientError('COORDINATOR_UNAVAILABLE');
    }
    const message: RpcRequest = { v: PROTOCOL_VERSION, id: randomUUID(), method, params, token };
    const response = await this.exchange(message, timeoutMs);
    if (!response.ok) {
      throw new CoordinatorClientError('COORDINATOR_ERROR', response.error.code);
    }
    return response.result as T;
  }

  private exchange(message: RpcRequest, timeoutMs: number): Promise<RpcResponse> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.endpoint);
      let settled = false;
      let received = Buffer.alloc(0);
      const finish = (outcome: { response: RpcResponse } | { error: CoordinatorClientError }): void => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        clearTimeout(requestTimer);
        socket.destroy();
        if ('response' in outcome) resolve(outcome.response);
        else reject(outcome.error);
      };
      const unavailable = (): void => finish({ error: new CoordinatorClientError('COORDINATOR_UNAVAILABLE') });
      const connectTimer = setTimeout(unavailable, Math.min(this.connectTimeoutMs, timeoutMs));
      const requestTimer = setTimeout(unavailable, timeoutMs);
      socket.on('connect', () => {
        clearTimeout(connectTimer);
        socket.write(`${JSON.stringify(message)}\n`);
      });
      socket.on('error', unavailable);
      socket.on('close', unavailable);
      socket.on('data', (chunk: Buffer) => {
        received = Buffer.concat([received, chunk]);
        const newline = received.indexOf(0x0a);
        if (newline === -1) {
          if (received.length > MAX_LINE_BYTES) unavailable();
          return;
        }
        try {
          const parsed = JSON.parse(received.subarray(0, newline).toString('utf8')) as RpcResponse;
          if (typeof parsed !== 'object' || parsed === null || typeof parsed.ok !== 'boolean') throw new Error('shape');
          finish({ response: parsed });
        } catch {
          finish({ error: new CoordinatorClientError('COORDINATOR_ERROR', 'INVALID_RESPONSE') });
        }
      });
    });
  }
}

function isAllocatedSession(value: unknown): value is AllocatedSession {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    ['sessionId', 'label', 'relativeDir', 'absoluteDir', 'sessionFile', 'historyFile', 'clipboardFile', 'startedAt'].every(
      (key) => typeof v[key] === 'string',
    ) && typeof v['sequence'] === 'number'
  );
}

/** Allocates session IDs by delegating to the primary. */
export class RemoteSessionIdAllocator implements SessionIdAllocator {
  constructor(private readonly requester: CoordinatorRequester) {}

  async allocate(request: AllocateSessionRequest): Promise<AllocatedSession> {
    const params: Record<string, unknown> = { windowId: request.windowId, kind: request.kind, cwdInitial: request.cwdInitial };
    if (request.sshAlias !== undefined) {
      params['sshAlias'] = request.sshAlias;
    }
    const result = await this.requester.request<unknown>('session.allocate', params, 15_000);
    if (!isAllocatedSession(result)) {
      throw new CoordinatorClientError('COORDINATOR_ERROR', 'INVALID_RESPONSE');
    }
    return result;
  }
}
