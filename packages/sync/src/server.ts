import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
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

export function coordinatorEndpoint(userDataPath: string, platform: NodeJS.Platform = process.platform): string {
  if (platform === 'win32') {
    const hash = createHash('sha256').update(path.resolve(userDataPath)).digest('hex').slice(0, 16);
    return `\\\\.\\pipe\\smart-terminal-${hash}`;
  }
  return path.join(userDataPath, 'coordinator', SOCKET_FILE_NAME);
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

/** Server RPC locale: Unix socket (dir 0700, socket 0600) o named pipe, protetto da token casuale. */
export class CoordinatorServer {
  readonly endpoint: string;
  readonly startedAt = new Date().toISOString();
  private readonly directory: string;
  private readonly tokenFile: string;
  private readonly platform: NodeJS.Platform;
  private readonly sockets = new Set<net.Socket>();
  private server: net.Server | undefined;
  private token = '';

  constructor(private readonly options: CoordinatorServerOptions) {
    this.platform = options.platform ?? process.platform;
    this.endpoint = coordinatorEndpoint(options.userDataPath, this.platform);
    this.directory = path.join(options.userDataPath, 'coordinator');
    this.tokenFile = tokenPath(options.userDataPath);
  }

  /** Va chiamato solo da chi detiene il lock primary: socket e token residui sono sovrascritti. */
  async start(): Promise<void> {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    if (this.platform !== 'win32') {
      fs.chmodSync(this.directory, 0o700);
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
    // Un nuovo primary potrebbe aver gia' sostituito socket/token: li rimuoviamo solo se sono ancora i nostri.
    try {
      if (fs.readFileSync(this.tokenFile, 'utf8') === this.token) {
        fs.rmSync(this.tokenFile, { force: true });
        if (this.platform !== 'win32') {
          fs.rmSync(this.endpoint, { force: true });
        }
      }
    } catch {
      // gia' rimossi
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
