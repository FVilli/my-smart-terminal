import * as pty from 'node-pty';
import type { PtyAdapter, PtyProcessLike, PtySpawnOptions } from './pty';

/** Native adapter: import only from the main process (loads the node-pty binding). */
export class NodePtyAdapter implements PtyAdapter {
  spawn(options: PtySpawnOptions): PtyProcessLike {
    const child = pty.spawn(options.file, options.args, {
      name: 'xterm-256color',
      cwd: options.cwd,
      env: options.env,
      cols: options.cols,
      rows: options.rows,
    });
    return {
      pid: child.pid,
      write: (data) => child.write(data),
      resize: (cols, rows) => child.resize(cols, rows),
      kill: () => child.kill(),
      onData: (listener) => {
        child.onData(listener);
      },
      onExit: (listener) => {
        child.onExit(({ exitCode, signal }) => listener({ exitCode, ...(signal !== undefined ? { signal } : {}) }));
      },
    };
  }
}
