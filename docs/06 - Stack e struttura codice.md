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
- UI: Angular standalone, strict TypeScript; CSS theme and Angular components.
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

## Targets
Linux, macOS, and Windows desktop; implementation and testing of the different PTYs and packages must be performed in the respective OS pipeline. The terminal must also work without Git, AI, or network.

## Implementation decisions
npm workspaces monorepo, `dist/apps/renderer/browser` output, local Markdown configuration, coordinator over socket/named pipe, `safeStorage`, and test toolchain: `docs/10 - Config locale, coordinatore e sicurezza runtime.md`.
