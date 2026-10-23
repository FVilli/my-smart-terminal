---
title: "Local configuration, coordinator, and runtime security"
type: adr
project: smart-terminal
version: 1
created: 2026-10-23
---
<!-- gsynchro:v1 id=37a01d97-fc66-464e-8edf-bbf5a5e3ae23 registered=2026-10-23T08:09:36.838Z -->

# ADR - Local configuration, coordinator, and runtime security

## Status
Accepted for M01-M06. The decisions integrate `docs/01`, `docs/03`, `docs/04`, `docs/06`, and `docs/07` without changing the stack.

## Context
Needed: initial configuration before a data clone exists, multiple independent Electron windows on the same machine, a single Git writer, and credentials outside shared Markdown. The specifications do not fix the local IPC transport, config format, or keychain mechanism.

## Decisions

### D1 - Local non-secret configuration
- Non-secret config is local Markdown at `app.getPath('userData')/config/config.md`; it is **not** synchronized and does **not** live in the data clone.
- The data clone contains only `sessions/`; its path is also per-machine config. Before onboarding, the default is `userData/data`, created locally with `sessions/`: shell and PTY work without network/AI/Git. Test override: `SMART_TERMINAL_DATA_REPO`.
- The `S<n>` counter lives in `sessions/<machine>/counter.md` (versioned metadata), protected by the primary lock; details in `docs/03`.
- Schema (`schema_version: 1`, flat frontmatter): `machine_name`, `data_repo_path`, `data_repo_remote?`, `ai_provider` (`none|anthropic|openai|openai-compatible`), `ai_base_url?`, `ai_model?`, `stt_provider` (`none|local|cloud`), `stt_model?`, `stt_command?` (absolute path for the local provider), `sync_debounce_ms?`, `sync_max_wait_ms?`, `sync_fetch_interval_ms?`, `clipboard_enabled?`. No token, key, or password.
- Path: `userData/config/config.md` (override `SMART_TERMINAL_CONFIG_PATH`); `.bak` backup of the last valid version, `.corrupt` quarantine, restore only if the backup is valid. Precedence env > config > default (repo, machine, remote, timings, clipboard) without mutating `process.env`.
- Atomic writes (temporary file in the same directory + rename) and validating parser with safe defaults. Unreadable file or unknown schema: back up the file and restore defaults without blocking the terminal.
- Machine identity is normalized `machine_name` (no slash); it is not derived from network hostname and is not shared.

### D2 - Local primary coordinator
- Each Electron window starts its own main process; **no** global single-instance lock.
- Election: lock directory `userData/coordinator/lock/` created atomically (`mkdir`) containing `owner.json` with `pid`, `nonce`, `created_at`, `heartbeat_at`. The lock does not prevent other windows from starting.
- Transport: Unix domain socket `userData/coordinator/coordinator.sock` with directory `0700` and socket `0600`; on Windows, named pipe `\\.\pipe\smart-terminal-<hash(userData)>`, nonce authentication. JSON-RPC protocol with whitelisted methods, maximum 1 MiB payload, parameter validation.
- Heartbeat every 3 s; takeover allowed only if the lock is stale (heartbeat older than 10 s) and the PID is no longer alive, or if the endpoint does not respond; final acquisition uses atomic `mkdir` again. Secondaries remain clients while the endpoint responds.
- JSON line-delimited protocol (max 1 MiB) with token in `userData/coordinator/token` (`0600`, constant-time comparison) and whitelisted methods; the client rereads the token for every request, so after a takeover it reaches the new primary.
- If the primary is unreachable, secondary allocation falls back to the shared-lock file allocator (same `primary.lock`/allocator lock): no blocking until takeover and no duplicate IDs. The role remains `secondary` until takeover succeeds.
- Known limit: the Unix socket path has a maximum of ~108 characters; very deep userData paths require a shorter path (M06 hardening).
- The coordinator is the sole owner of machine counters, shared writes, index, and Git. The renderer receives no privileges from the primary role.
- `S<n>` allocation is wrapped behind a service: M03 uses the local lock, M04 exposes it from the primary through local IPC without creating a second incompatible lock.

### D2b - Installation identity and setup verification
- `userData/installation.md` is local Markdown with `schema_version: 1`, `installation_id` (UUID generated once) and `created_at`; it is not synchronized and contains no secrets.
- Setup verification writes `instances/<machine>-<installation-id>.md` (app version, platform, architecture, timestamps) and performs an explicit path-scoped commit and push when a remote exists.
- Git scope is `sessions/` plus `instances/`; no other path is staged, no force push. A failed push keeps the local commit and exposes a recoverable error. Tracked changes outside those directories refuse the setup test.

### D3 - Credentials and keychain
- AI/STT tokens are managed only in the main process with Electron `safeStorage`, never in the renderer or in plaintext. Encrypted files `userData/secrets/<provider>.json` use permissions `0600` and atomic writes; the renderer sees only the list of present keys.
- On Linux, the effective backend matters: if it is `basic_text` or encryption is unavailable, the token is not persisted; only an in-memory session credential is allowed, with an explicit UI indication. No plaintext fallback.
- Logout/revocation removes the token from the keychain and memory.

### D4 - Toolchain and tests
- npm workspaces follow the structure in `docs/06`; exact versions are in the lockfile. Development tooling: `esbuild` for main/preload bundles, `concurrently`/`wait-on`/`cross-env` for the dev workflow, and `electron-builder` for packages. These are not additional runtimes.
- Angular application builder outputs to `dist/apps/renderer/browser`; Electron loads `file://` in production and the dev-server URL in development.
- Vitest for package and integration tests; injectable PTY adapter and mocks in unit tests. Coordinator/Git tests use child processes, temporary directories, and local bare repositories, without a display. Electron smoke tests use `xvfb-run` in Linux CI.

## Consequences
- Local configuration is not shared between machines: machine name and paths remain correct for each installation.
- A primary crash is recoverable without losing sessions; window PTYs remain active.
- Without a suitable keyring, cloud AI/STT remain disabled while the terminal, Markdown, and Git continue to work.
- Portability tests require the corresponding OS pipeline for `node-pty` and packaging.

## References
`docs/01 - Architecture.md`, `docs/03 - Markdown schema.md`, `docs/04 - Sync Git.md`, `docs/05 - AI, voice and security.md`, `docs/06 - Stack and code structure.md`, `docs/07 - Runtime logic.md`.
