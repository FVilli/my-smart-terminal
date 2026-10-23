/** Helper process for concurrency tests: allocates N sessions and prints their IDs to stdout (JSON). */
import { FileSessionIdAllocator } from './session-id';

const [dataRepoPath, machine, lockDir, count] = process.argv.slice(2);
if (dataRepoPath === undefined || machine === undefined || lockDir === undefined || count === undefined) {
  throw new Error('usage: session-id.worker <dataRepoPath> <machine> <lockDir> <count>');
}

async function main(): Promise<void> {
  const allocator = new FileSessionIdAllocator({ dataRepoPath: dataRepoPath!, machine: machine!, lockDir: lockDir!, timeoutMs: 30_000 });
  const labels: string[] = [];
  for (let index = 0; index < Number(count); index += 1) {
    labels.push((await allocator.allocate({ windowId: `worker-${process.pid}`, kind: 'local', cwdInitial: '/tmp' })).label);
  }
  process.stdout.write(JSON.stringify(labels));
}

void main();
