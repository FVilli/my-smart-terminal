import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolvePath = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@smart-terminal/contracts': resolvePath('./packages/contracts/src/index.ts'),
      '@smart-terminal/terminal/node-pty': resolvePath('./packages/terminal/src/node-pty-adapter.ts'),
      '@smart-terminal/terminal': resolvePath('./packages/terminal/src/index.ts'),
      '@smart-terminal/data': resolvePath('./packages/data/src/index.ts'),
      '@smart-terminal/sync': resolvePath('./packages/sync/src/index.ts'),
      '@smart-terminal/ai': resolvePath('./packages/ai/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'packages/**/*.spec.ts',
      'apps/desktop/**/*.spec.ts',
      'tests/**/*.spec.ts',
    ],
    exclude: ['node_modules/**', 'dist/**', 'apps/renderer/**'],
    reporters: ['default'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
