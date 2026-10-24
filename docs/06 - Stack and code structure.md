---
title: Stack and code structure
type: architecture
project: smart-terminal
version: 1
created: 2026-10-22
---
<!-- gsynchro:v1 id=a1d8fd30-27d1-4418-ba70-e2a182bdd71a registered=2026-10-23T07:57:46.927Z -->
# Stack and code structure

## Required stack
- Desktop: Electron, separate main/preload/renderer processes.
- UI: Angular standalone, strict TypeScript; Tailwind CSS 4 utilities plus a small set of semantic design tokens (see Styling).
- Terminal: `@xterm/xterm` + fit addon; PTY: `node-pty` in an unprivileged Node process.
- Persistence: Markdown files only in the shared Git clone; no SQLite, no database, no remote storage other than the selected Git.
- Synchronization: Git CLI (`fetch`, `commit`, `rebase`, `push`) serialized by the per-machine coordinator service.
- SSH: system OpenSSH binary and Host/Include configuration parsing; do not implement the SSH protocol in JavaScript.
- AI: Anthropic, OpenAI, and OpenAI-compatible endpoint adapters; local/cloud STT behind a separate adapter.
- Secrets: system keychain; never in the data repository.

## Monorepo
```text
apps/desktop/       # Electron main, preload, packaging
apps/renderer/      # Angular + xterm.js
packages/contracts/ # shared IPC types and events
packages/terminal/  # PTY, session lifecycle, SSH
packages/data/      # Markdown read/write, in-memory search
packages/sync/      # primary coordinator, Git, debounce
packages/ai/        # providers, correction, STT
```

## Contracts
The renderer accesses the filesystem, processes, Git, and credentials only through explicit, typed preload APIs. `contextIsolation=true`, `nodeIntegration=false`; validate all IPC requests. Exact dependency versions are pinned in the lockfile during M01, with no automatic updates by subsequent tasks.

## SSH
- Read-only parser for `~/.ssh/config` (`SMART_TERMINAL_SSH_CONFIG` override) with `Host`, `Include`, and globs, limited recursion, and concrete aliases; `Match`/wildcards ignored.
- Execution through the OpenSSH binary (`ssh <alias>`) as file+args, never a shell string; alias validated, environment inherited (including `SSH_AUTH_SOCK`), no key read or copied.

## Styling
- Tailwind CSS 4 (`tailwindcss` + `@tailwindcss/postcss`, pinned exact versions) is the single utility system. Angular's builder loads it through `apps/renderer/.postcssrc.json`; `apps/renderer/src/styles.css` imports `tailwindcss/theme.css` and `tailwindcss/utilities.css` in the `theme`/`utilities` layers, declares `@source "./app"` and `@source "./index.html"`, and imports `@xterm/xterm/css/xterm.css`. Nothing is loaded from a CDN and there is no runtime CSS engine.
- Tailwind preflight is intentionally not imported: the renderer keeps its own minimal reset in `@layer base`. That reset is layered so utilities can override UA button/input/select defaults; putting it outside a layer made `font: inherit` win over `font-size` utilities.
- Tokens: raw palette, typography and measured geometry live once in `:root`; `@theme inline` exposes them as utilities (`bg-terminal`, `bg-tab`, `text-fg`, `text-muted`, `border-line`, `bg-accent`, `h-header`, `h-tabbar`, `h-footer`, `h-composer`, `max-w-tab`, `font-mono`). Mapping table and ownership: `docs/15 - Visual baseline.md`.
- Shared controls are defined once in `@layer components`: `.btn`, `.icon-btn`, `.field`, `.field-sm`, `.card`, plus Tailwind's built-in `sr-only`. Layout, spacing and one-off states are utilities in the component template; component `styles` blocks remain only for genuinely complex rules (window drag regions, state rules bound to Angular classes, the mic pulse keyframes, the fixed-height settings dialog, STT glyphs and table, xterm host/status). xterm keeps its own stylesheet and the `TERMINAL_THEME` literals required by the canvas renderer.
- Host-level layout (`display`, `flex`, borders) uses Angular `host: { class: '...' }` metadata so it is scanned by Tailwind. Every pre-M20 visual contract (75/25 split, 35/38/28 px chrome, 120 px composer, active tab and surface colors, focus rings, zoom 50–200 %) is preserved and verified by `npm run test:layout`, `scripts/capture-screenshots.mjs` and `apps/desktop/src/main/smoke.ts`.

## Targets
Linux, macOS, and Windows desktop; implementation and testing of the different PTYs and packages must be performed in the respective OS pipeline. The terminal must also work without Git, AI, or network.

## Implementation decisions
npm workspaces monorepo, `dist/apps/renderer/browser` output, local Markdown configuration, coordinator over socket/named pipe, `safeStorage`, and test toolchain: `docs/10 - Local config, coordinator and runtime security.md`.
