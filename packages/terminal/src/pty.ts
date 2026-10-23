export interface PtySpawnOptions {
  file: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  cols: number;
  rows: number;
}

export interface PtyExitInfo {
  exitCode: number;
  signal?: number;
}

export interface PtyProcessLike {
  readonly pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(listener: (data: string) => void): void;
  onExit(listener: (info: PtyExitInfo) => void): void;
}

export interface PtyAdapter {
  spawn(options: PtySpawnOptions): PtyProcessLike;
}
