import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {
  MAX_LINE_BYTES,
  RpcFailure,
  dispatchRpc,
  parseRequestLine,
  sanitizeError,
  type CoordinatorServices,
  type RpcResponse,
} from './protocol';

export const TOKEN_FILE_NAME = 'token';
export const SOCKET_FILE_NAME = 'coordinator.sock';
const IDLE_TIMEOUT_MS = 30_000;

const UNIX_SOCKET_MAX_PATH = 100;

/** Socket directory: use userData if the path stays below the sockaddr limit; otherwise use a private temporary directory. */
export function coordinatorSocketDirectory(userDataPath: string, platform: NodeJS.Platform = process.platform): string {
  const coordinatorDir = path.join(userDataPath, 'coordinator');
  if (platform === 'win32') {
    return coordinatorDir;
  }
  if (Buffer.byteLength(path.join(coordinatorDir, SOCKET_FILE_NAME)) < UNIX_SOCKET_MAX_PATH) {
    return coordinatorDir;
  }
  const hash = createHash('sha256').update(path.resolve(userDataPath)).digest('hex').slice(0, 16);
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';
  return path.join(os.tmpdir(), `smart-terminal-${uid}-${hash}`);
}

export function coordinatorEndpoint(userDataPath: string, platform: NodeJS.Platform = process.platform): string {
  if (platform === 'win32') {
    const hash = createHash('sha256').update(path.resolve(userDataPath)).digest('hex').slice(0, 16);
    return `\\\\.\\pipe\\smart-terminal-${hash}`;
  }
  return path.join(coordinatorSocketDirectory(userDataPath, platform), SOCKET_FILE_NAME);
}

export function tokenPath(userDataPath: string): string {
  return path.join(userDataPath, 'coordinator', TOKEN_FILE_NAME);
}

function tokensEqual(expected: string, received: string): boolean {
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(received).digest();
  return timingSafeEqual(a, b);
}

export interface CoordinatorServerOptions {
  userDataPath: string;
  services: CoordinatorServices;
  platform?: NodeJS.Platform;
}

/** Local RPC server: Unix socket (directory 0700, socket 0600) or named pipe, protected by a random token. */
export class CoordinatorServer {
  readonly endpoint: string;
  readonly startedAt = new Date().toISOString();
  private readonly socketDirectory: string;
  private readonly coordinatorDirectory: string;
  private readonly tokenFile: string;
  private readonly platform: NodeJS.Platform;
  private readonly sockets = new Set<net.Socket>();
  private server: net.Server | undefined;
  private token = '';

  constructor(private readonly options: CoordinatorServerOptions) {
    this.platform = options.platform ?? process.platform;
    this.endpoint = coordinatorEndpoint(options.userDataPath, this.platform);
    this.socketDirectory = coordinatorSocketDirectory(options.userDataPath, this.platform);
    this.coordinatorDirectory = path.join(options.userDataPath, 'coordinator');
    this.tokenFile = tokenPath(options.userDataPath);
  }

  /** Call only while holding the primary lock: stale sockets and tokens are overwritten. */
  async start(): Promise<void> {
    fs.mkdirSync(this.socketDirectory, { recursive: true, mode: 0o700 });
    fs.mkdirSync(this.coordinatorDirectory, { recursive: true, mode: 0o700 });
    if (this.platform !== 'win32') {
      fs.chmodSync(this.socketDirectory, 0o700);
      fs.rmSync(this.endpoint, { force: true });
    }
    fs.rmSync(this.tokenFile, { force: true });
    this.token = randomBytes(32).toString('hex');
    const server = net.createServer((socket) => this.handleConnection(socket));
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.endpoint, () => {
        server.off('error', reject);
        resolve();
      });
    });
    server.on('error', () => undefined);
    this.server = server;
    try {
      if (this.platform !== 'win32') {
        fs.chmodSync(this.endpoint, 0o600);
      }
      const temporary = `${this.tokenFile}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, this.token, { mode: 0o600 });
      fs.renameSync(temporary, this.tokenFile);
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();
    if (server !== undefined) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    // A new primary may have already replaced the socket/token: remove them only if they are still ours.
    try {
      if (fs.readFileSync(this.tokenFile, 'utf8') === this.token) {
        fs.rmSync(this.tokenFile, { force: true });
        if (this.platform !== 'win32') {
          fs.rmSync(this.endpoint, { force: true });
        }
      }
    } catch {
      // already removed
    }
  }

  private handleConnection(socket: net.Socket): void {
    this.sockets.add(socket);
    socket.setTimeout(IDLE_TIMEOUT_MS, () => socket.destroy());
    socket.on('close', () => this.sockets.delete(socket));
    socket.on('error', () => socket.destroy());
    let buffer = Buffer.alloc(0);
    let queue: Promise<void> = Promise.resolve();
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      let newline = buffer.indexOf(0x0a);
      while (newline !== -1) {
        const line = buffer.subarray(0, newline);
        buffer = buffer.subarray(newline + 1);
        if (line.length > MAX_LINE_BYTES) {
          return this.rejectOversize(socket);
        }
        const text = line.toString('utf8');
        queue = queue.then(() => this.handleLine(socket, text));
        newline = buffer.indexOf(0x0a);
      }
      if (buffer.length > MAX_LINE_BYTES) {
        this.rejectOversize(socket);
      }
    });
  }

  private rejectOversize(socket: net.Socket): void {
    this.send(socket, { id: '', ok: false, error: { code: 'LINE_TOO_LONG', message: 'LINE_TOO_LONG' } });
    socket.end();
  }

  private async handleLine(socket: net.Socket, line: string): Promise<void> {
    let id = '';
    try {
      const request = parseRequestLine(line);
      id = request.id;
      if (!tokensEqual(this.token, request.token)) {
        throw new RpcFailure('UNAUTHORIZED');
      }
      const result = await dispatchRpc(request.method, request.params, this.options.services, {
        startedAt: this.startedAt,
        pid: process.pid,
      });
      this.send(socket, { id, ok: true, result });
    } catch (error) {
      this.send(socket, { id, ok: false, error: sanitizeError(error) });
    }
  }

  private send(socket: net.Socket, response: RpcResponse): void {
    if (!socket.destroyed) {
      socket.write(`${JSON.stringify(response)}\n`);
    }
  }
}
