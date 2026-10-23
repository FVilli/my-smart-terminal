import { context } from 'esbuild';

const watch = process.argv.includes('--watch');
const isProduction = process.env.NODE_ENV === 'production';

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: !isProduction,
  minify: isProduction,
  tsconfig: 'tsconfig.json',
  external: ['electron', 'node-pty'],
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
  },
};

const entries = [
  { in: 'apps/desktop/src/main/main.ts', out: 'dist/apps/desktop/main' },
  { in: 'apps/desktop/src/preload/preload.ts', out: 'dist/apps/desktop/preload' },
];

const contexts = await Promise.all(
  entries.map((entry) =>
    context({
      ...shared,
      entryPoints: [entry.in],
      outfile: `${entry.out}.js`,
    }),
  ),
);

if (watch) {
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('[build-desktop] watching main and preload');
} else {
  await Promise.all(contexts.map((ctx) => ctx.rebuild()));
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
  console.log('[build-desktop] built main and preload');
}
