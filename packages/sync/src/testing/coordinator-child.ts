/** Child process for multi-process tests: starts a Coordinator and prints role changes (one JSON line each). */
import path from 'node:path';
import { FileSessionIdAllocator } from '@smart-terminal/data';
import { Coordinator } from '../coordinator';

const userDataPath = process.env['CHILD_USER_DATA'] ?? '';
const repo = path.join(userDataPath, 'repo');
const allocator = new FileSessionIdAllocator({
  dataRepoPath: repo,
  machine: 'host',
  lockDir: path.join(userDataPath, 'coordinator', 'locks'),
});

const coordinator = new Coordinator({
  userDataPath,
  heartbeatMs: 100,
  staleMs: 800,
  takeoverPollMs: 100,
  createPrimary: () => ({
    services: {
      allocate: (request) => allocator.allocate(request),
      searchQuery: () => [],
      searchUpsert: () => undefined,
      searchRefresh: () => undefined,
      syncStatus: () => ({ state: 'synced', remoteConfigured: false }),
    searchFacets: () => [],
    searchRemove: () => ({ removed: false }),
    clipboardState: () => ({ enabled: false, paused: false, lastEventAt: null }),
    clipboardConfigure: () => ({ enabled: false, paused: false, lastEventAt: null }),
    clipboardSetActive: () => ({ enabled: false, paused: false, lastEventAt: null }),
    clipboardClear: () => ({ enabled: false, paused: false, lastEventAt: null }),
    sessionEnd: () => undefined,
      syncDirty: () => undefined,
    },
    stop: () => undefined,
  }),
});

coordinator.onRoleChange((role) => process.stdout.write(`${JSON.stringify({ pid: process.pid, role })}\n`));
process.on('SIGTERM', () => {
  void coordinator.stop().then(() => process.exit(0));
});
void coordinator.start().then(() => process.stdout.write(`${JSON.stringify({ pid: process.pid, ready: true })}\n`));
setInterval(() => undefined, 1000);
