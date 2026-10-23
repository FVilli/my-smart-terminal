---
title: "IPC contracts and runtime verification"
type: contract
project: smart-terminal
version: 1
created: 2026-10-23
---
<!-- gsynchro:v1 id=65893937-7b8b-4a2a-8d10-a731a2aad10b registered=2026-10-23T08:19:15.144Z -->

# IPC contracts and runtime verification

Operational document: lists the main/preload/renderer boundaries and verification commands. Normative sources remain `docs/01`, `docs/06`, and `docs/10`.

## Rules
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; the renderer cannot access `require`/`process`.
- The preload exposes only typed methods; no generic `invoke` in production.
- Every channel is whitelisted in `packages/contracts/src/index.ts`, validated in main (payload, size, main-frame sender, and origin) and returns coded errors without paths or stacks.
- JSON payload limit 128 KiB; field-specific limits (for example, PTY write 64 KiB, dimensions 1-1000).
- Main→renderer events are separate from invokable channels and support unsubscribe.

## Invokable channels (M01 status)
| Channel | Payload | Response |
| --- | --- | --- |
| `app:ping` | nessuno | `{ appVersion, platform }` |
| `app:runtime-info` | nessuno | `{ appVersion, platform, isPackaged }` |
| `terminal:create` | `{ kind:'local', cwd?, cols?, rows? }` | `TerminalSessionInfo` |
| `terminal:write` | `{ sessionId, data }` | `void` |
| `terminal:resize` | `{ sessionId, cols, rows }` | `void` |
| `terminal:close` | `{ sessionId }` | `void` |
| `terminal:list` | nessuno | `TerminalSessionInfo[]` |
| `history:record` (T03) | `{ sessionId, text, agent? }` | `{ recorded: boolean }` |
| `clipboard:configure` (T04) | `{ enabled?, paused? }` | clipboard state |
| `clipboard:set-active` (T04) | `{ sessionId }` | `void` |
| `clipboard:clear` (T04) | nessuno | `void` |
| `search:query` (T05) | `{ query, machine?, sessionId?, from?, to? }` | results (cap 100) |

Events: `terminal:data` (`{ sessionId, data }`), `terminal:exit` (`{ sessionId, exitCode, signal? }`). Each window has its own `SessionManager`; PTYs are terminated on close/destruction.

## API preload
`ping`, `runtimeInfo`, `createTerminal`, `writeTerminal`, `resizeTerminal`, `closeTerminal`, `listTerminals`, `onTerminalData`, `onTerminalExit`, `recordHistory`, `clipboardState`, `clipboardConfigure`, `clipboardSetActive`, `clipboardClear`, `clipboardWrite`, `search`, `searchFacets`, `syncStatus`, `onSyncStatus`, `onRoleChanged`, `onSearchRefreshed`. The `__testInvoke` seam exists only with the startup argument `--smart-terminal-test-ipc`, enabled by smoke tests.

## History and clipboard (M03)
- `history:record` accepts only `{sessionId, text, agent?}`, fixed source `assisted`, testo ≤16 KiB, `agent` ≤64 char. Sensitive text: `{recorded:false}`. The renderer calls it only after a successful editor submission; no keystrokes or native shell history.
- Clipboard: opt-in (default off; `SMART_TERMINAL_CLIPBOARD=1` to enable it at startup), polling 800 ms, max 32 KiB UTF-8, hash SHA-256, dedupe in memory and against the file, best-effort secret filter, pause/clear. Associated with the active session on tab/focus.
- `search:query` is case-insensitive, filters machine/session/date/kind, caps at 100, and returns history/clipboard entries; the index is in memory and rebuilt at startup.

## Runtime persistence (M03)
- Data repository: `SMART_TERMINAL_DATA_REPO` or `userData/data`; `sessions/<machine>/` created locally. Machine: `SMART_TERMINAL_MACHINE` or normalized hostname.
- `counter.md` in `sessions/<machine>/` with `schema_version`, `machine`, `last_session`, `updated_at`; atomic reservation under lock in `userData/coordinator/locks`, stale recovery, no reuse.
- Session directory `YYYY-MM-DD_HH.mm_S<n>_<local|alias>` with `session.md`, `history.md`, `clipboard.md`.
- Common frontmatter: `schema_version: 1`, `session_id`, `machine`, `created_at`; `session.md` aggiunge `window_id`, `kind`, `ssh_alias?`, `cwd_initial`, `started_at`, `ended_at?`.
- History events: `## <ISO8601> · <id>`, campi `source`, `agent?`, `cwd?`, fenced block `text`; clipboard: `type`, `source?`, `hash`, blocco `text`. Dynamic fence, dedupe by id/hash.
- `TerminalSessionInfo` espone `sessionId`/`label` (`S<n>`), `machine`, `sessionDirectory`, `startedAt`.
- History M03: explicit assisted-editor submissions only (`source: assisted`); no keystrokes or TUI prompts. Deviation documented in `docs/03`.
- Clipboard: opt-in, polling ~800 ms, hash SHA-256, 32 KiB limit, best-effort secret filter, pause/clear, association with the active session.
- Search index: rebuilt at startup, updated on app writes, refreshed after Git; Markdown only under `sessions/`, no symlinks, size limits.

## Coordinator and Git (M04)
- Lock `userData/coordinator/primary.lock` (atomic mkdir, owner.json, heartbeat 3 s, stale 10 s, recovery with nonce); one primary per machine.
- Socket Unix `userData/coordinator/coordinator.sock` (`0700`/`0600`) or Windows named pipe; token `0600`; JSON line-delimited protocol max 1 MiB.
- Methods: `ping`, `session.allocate`, `session.end`, `search.query`, `search.upsert`, `search.refresh`, `search.facets`, `sync.status`, `sync.dirty`, `clipboard.state`, `clipboard.configure`, `clipboard.setActive` (sessionDirectory validata), `clipboard.clear`.
- `AppRuntimeInfo.isPrimary` and `app:role-changed` event; `sync:status` event with `{state,lastSyncAt?,lastError?,remoteConfigured}`; dynamic footer.
- Scheduler Git: debounce 10 s, max wait 60 s, fetch 15 s, flush a stop; env `SMART_TERMINAL_SYNC_*`.
- Git: serialized `GitEngine`, stage only `sessions/`, path-scoped commits, fetch/rebase/push without force, conflicts with abort and preserved files, offline with local commits. Env: `SMART_TERMINAL_GIT_REMOTE`, `SMART_TERMINAL_GIT_BRANCH`.

## Virtual display for smoke tests (Linux)
- Electron smoke tests must not use the user's desktop. `scripts/run-electron.mjs` starts the app on a dedicated Xvfb display (`:99` by default), and all `test:*-smoke` and `test:layout` scripts run through it.
- In Wayland sessions, `DISPLAY=:99` alone is not enough: Electron would use `WAYLAND_DISPLAY` and appear on the desktop. The wrapper removes `WAYLAND_DISPLAY` and forces `ELECTRON_OZONE_PLATFORM_HINT=x11`, `GDK_BACKEND=x11`, and `--ozone-platform=x11`.
- `node_modules/.bin/electron` is replaced by a shim (`npm run setup:test-display`, automatic via `postinstall`) that invokes the same wrapper: even a direct `electron` command stays on Xvfb. To use the real desktop: `SMART_TERMINAL_NO_XVFB=1`.
- Xvfb search order: `SMART_TERMINAL_XVFB_BIN`, `/usr/bin/Xvfb`, `/usr/local/bin/Xvfb`, `~/.local/xvfb/usr/bin/Xvfb`. If unavailable, warn and use the current display.
- Override: `SMART_TERMINAL_XVFB_DISPLAY` (for example, `:98`), `SMART_TERMINAL_NO_XVFB=1` to return to the current display (not recommended in an interactive session).
- Rootless installation: `apt-get download xvfb xserver-common xauth`, then `dpkg-deb -x <deb> ~/.local/xvfb`; the helper finds it in `~/.local/xvfb/usr/bin/Xvfb`.
- `scripts/capture-layout.mjs` uses the same wrapper, so screenshots go to `dist/layout/` without opening windows on the desktop.
- In Linux CI use `xvfb-run` or install Xvfb; on macOS/Windows the wrapper leaves the runners' native display.

## Hardening (M06-T02)
- Renderer protocol and navigation with exact origin, anti-traversal/null byte; symlinks rejected in session paths; long socket path with per-user temp fallback.
- Git remote URL also validated from env; per-channel payload limits; full checklist in `docs/13 - Security checklist.md`.

## PTY
- `packages/terminal` contains interfaces and a testable `SessionManager`; the native adapter is in subpath `@smart-terminal/terminal/node-pty` and must be imported only by main.
- Files and args are always separate (never a shell string composed from IPC). `cwd` must be absolute and existing.
- `node-pty` must be rebuilt for the Electron ABI con `npm run rebuild:native`; unit tests use a fake adapter and do not load the binding.

## Commands
| Command | What it verifies |
| --- | --- |
| `npm run lint` | ESLint on TS/HTML |
| `npx tsc -p tsconfig.json --noEmit` | typecheck main/packages |
| `npm run test` | unit test Vitest (IPC, SessionManager, data schema/allocatore, runtime) |
| `npm run test:data` | targeted data package and data runtime tests |
| `npm run test:coordinator` | multi-process election, takeover, protocol, Git with bare repository |
| `npm run test:e2e` | two real Electron instances: single primary, distinct IDs, failover, and cross-machine operation on bare Git |
| `node scripts/run-electron.mjs apps/desktop` | Electron startup on Xvfb `:99` (usato dagli smoke) |
| `npm run build` | bundle main/preload + Angular production |
| `npm run test:ipc-smoke` | Electron window, valid API, payload/channel rejection, renderer without Node |
| `npm run test:pty-smoke` | native rebuild + real shell: output, input, resize, list, exit |
| `SMART_TERMINAL_SMOKE=1 npx electron apps/desktop` | smoke UI/IPC equivalent |
| `SMART_TERMINAL_PTY_SMOKE=1 npx electron apps/desktop` | smoke PTY (requires native rebuild) |
| `npm run test:layout` | screenshot 1440x900 e 1024x700, ratio 75/25, no overflow (main+sidebar) |
| `npm run test:tabs-smoke` | two tabs, switch without kill, close |
| `npm run test:editor-smoke` | Enter/Shift+Enter, executed marker, cleared draft, per-tab drafts |
| `npm run test:sidebar-smoke` | Clipboard/History switch, placeholder, sync/primary footer |
| `npm run test:clipboard-smoke` | opt-in, pause, real event, hash, sensitive pattern ignored |
| `npm run test:search-smoke` | indexed assisted submission, filters, sensitive content excluded, rebuild from disk |

## STT (M05-T04)
- Channels `stt:status` and `stt:transcribe {audio: Uint8Array, mimeType}`; audio ≤10 MiB, MIME `audio/*` without parameters, per-channel payload limit. Response `{text, skipped, reason?}`.
- Local provider (absolute `stt_command`, stdin, no shell/no file) or OpenAI cloud (`stt:cloud`, `/audio/transcriptions`); tokens and audio remain in main and are not logged.
- Renderer: push-to-talk, permissions/deny, `Voice ready`/`Listening…`/`Transcribing…`/errors, editable result without automatic submission, no persistent recording.
- Smoke `test:stt-smoke` with `SMART_TERMINAL_STT_TEST_MODE=1`; no real audio/API.

## AI correction (M05-T03)
- Channels `ai:status` and `ai:correct {text}`; `text` ≤16 KiB. Main reads config/token, skips shell commands, and calls the adapter; response `{original, corrected, changed, skipped, reason?}`.
- The renderer shows only status/result, applies the correction to the draft, and never submits automatically. Tokens and provider calls remain in main.
- Smoke `test:ai-smoke` with `SMART_TERMINAL_AI_TEST_MODE=1`; no real network.

## Sidebar globale e sync (M04-T04)
- History: case-insensitive search with ~200 ms debounce, machine filter from index facets, entries from all synchronized machines, copy and insert into the draft (never automatic submission).
- Clipboard: list of captured entries, copy/insert, opt-in/pause/clear controls; polling is owned by the primary even for secondary windows through RPC.
- Footer: `GitHub synced/syncing/offline/error`, "Repo not configured" if the remote is missing, primary indicator from the actual role.
- Refresh: `sync:status`/`search:refreshed` event, window focus, 5 s status polling and 15 s list polling; errors do not block the PTY.
- Periodic fetch integrates remote commits when the tracked working tree is clean; prompts from another machine become visible without local writes.

## SSH e onboarding (M05)
- `ssh:aliases` reads `~/.ssh/config` (Include/glob); `createTerminal` accepts `{kind:'local'|'ssh', sshAlias?}`. SSH errors do not block other sessions.
- Config: `userData/config/config.md` (override `SMART_TERMINAL_CONFIG_PATH`) con i campi di `docs/10`; onboarding `onboarding:state|validate|save|skip`, `secrets:status|logout`, `app:relaunch`.
- Secrets: `safeStorage`, files `0600`; on Linux, `basic_text`/unknown backend or unavailable encryption -> session memory only, explicit warning, never plaintext.
- Env: `SMART_TERMINAL_SSH_CONFIG`, `SMART_TERMINAL_SSH_BINARY`, `SMART_TERMINAL_CONFIG_PATH`, `SMART_TERMINAL_USER_DATA`.
- Smoke: `test:ssh-smoke`, `test:onboarding-smoke`.

## Assisted editor
- Enter submits to the active PTY; Shift+Enter inserts a newline; IME does not submit. The submit button is enabled only with a non-empty draft and a running session.
- Submission adds `\r` if absent, does not exceed 64 KiB UTF-8, and clears the draft only on success.
- The key handler is only on the textarea: xterm/TUI are not intercepted and there are no global listeners.
- AI correction and microphone have been active since M05 (provider/keychain/permissions).

## Known debt
- The `smart-terminal://` and `will-navigate` protocol will be hardened in M06 (exact origin, path traversal, null byte).
- The coordinator, Git sync, and global UI search are not active yet (M04).
