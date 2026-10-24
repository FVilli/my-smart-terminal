---
title: "Security checklist"
type: security
project: smart-terminal
version: 1
created: 2026-10-23
---
<!-- gsynchro:v1 id=7e113487-ddbb-4a25-80fb-dc9a7e4d2964 registered=2026-10-23T09:58:42.367Z -->

# Security checklist

Verification performed on M06-T02. Each item states its status, implementation, and test/limitation.

## Electron and renderer
- [x] `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; preload with whitelisted APIs. Test: IPC smoke verifies `require`/`process` undefined.
- [x] `setWindowOpenHandler` denies new windows; `will-navigate` compares the **exact origin** (dev server or `smart-terminal://bundle`). Test: `navigation.spec.ts`.
- [x] `smart-terminal://` protocol validates host, decodable URIs, null bytes, traversal, and containment within the renderer root. Test: `navigation.spec.ts`.
- [x] CSP without `unsafe-eval`; scripts self-only; no webview/`enableRemoteModule`.
- [x] Permission handler grants only `media` audio; camera/video denied. Microphone explicitly requested by the wizard/STT.
- [x] No `shell.openExternal`, `eval`, `new Function`, or string `exec`.

## IPC
- [x] Sender: tracked window ID + main frame + origin; payload with exact keys, types, ranges, and limits.
- [x] Global 128 KiB limit; STT audio has a 10 MiB per-channel limit + margin and real binary counting.
- [x] Sanitized errors: stable codes, no stack/path/token to the renderer.
- [x] AI/STT channels: text/audio also validated in main (defense in depth); token never returned.
- [x] Setup AI: `setup:test-ai` / `setupTestAi` validates provider/base URL/model/token configuration in main, accepts current unsaved values, and is available only in the main process; token is never returned.
- [x] STT setup: `sttBaseUrl`, `sttResponseFormat` (`json`/`verbose_json`), `sttLanguage`, and `sttUseAiProvider` are validated in main; shared mode uses the AI token and never returns it; URLs reject credentials and queries.
- [x] Window control: `window:control` accepts only minimize, toggle-maximize, and close; maximize state is emitted through `window:maximized`.
- [x] Negative tests: invalid payloads, unknown channel, oversize, wrong sender, subframe, foreign origin.

## Files and paths
- [x] Machine/destination normalized; session path with `sessions/<machine>/` prefix and validated timestamp/ID.
- [x] `assertNoSymlinkComponents` rejects symlinks in `sessions/`, machine, or session directory (history/clipboard writes and allocator). Dedicated test.
- [x] Atomic writes (tmp + rename); data/secrets directories `0700`, secret files `0600`.
- [x] Search does not follow symlinks, skips files >2 MiB; lock/tmp files are not versioned.

## Secrets
- [x] AI/STT tokens only in main, encrypted with `safeStorage`; Linux `basic_text`/unknown backend or unavailable encryption -> memory only, warning, never plaintext.
- [x] Renderer receives only status/keys, never the token; logout deletes file and memory.
- [x] Markdown config contains no secrets; parser rejects unknown fields, URLs with credentials/query, and remotes with passwords.
- [x] Logs/build: no token, audio, or AI text logging; audit with `rg` and tests.

## History, clipboard, AI, STT
- [x] History only from explicit editor submissions; no keystrokes/TUI; best-effort secret filter; opt-out.
- [x] Clipboard opt-in, pause/clear, hash + dedupe, 32 KiB limit, best-effort secret filter.
- [x] AI: explicit click only, shell detection, timeout/fallback, no automatic execution.
- [x] STT: push-to-talk, permissions, audio in memory only, no temporary files, absolute local command without shell; base URL, response format, and language are constrained.
- [x] Current smoke coverage: `npm run test:ipc-smoke`, `npm run test:ai-setup-smoke`, `npm run test:stt-setup-smoke`, `npm run test:stt-smoke`, and `npm run test:settings-smoke`.

## Coordinator and Git
- [x] Primary lock with atomic mkdir, nonce, heartbeat, stale recovery; renderer gains no privileges from the role.
- [x] Unix socket `0600` in `0700` directory or named pipe; token `0600` constant-time; JSON line protocol max 1 MiB, whitelisted methods/params.
- [x] Socket path over ~100 chars -> private per-user temp directory (tested fallback).
- [x] Git through `execFile`, validated branch, remote rejects `-`, control/whitespace and embedded passwords; stage only `sessions/` + `instances/`; never `--force`.
- [x] SSH: validated alias, separate file+args, no key read/copied, inherited agent.

## Accepted residual risks
- Heuristic secret filters: they do not guarantee detection of every secret.
- Windows named pipe has no dedicated ACLs: token authentication, same user; future ACL hardening.
- Git can execute hooks/config from the selected data repository: the repository is trusted by definition; do not clone untrusted repositories.
- `safeStorage` depends on the OS keyring; without a secure backend, tokens remain in memory.
- macOS/Windows signing unavailable: artifacts declared unsigned until certificates exist.
- No auto-update in V1; manual updates.

## Verification commands
`npm run test`, `npm run test:coordinator`, `npm run test:e2e`, `npm run test:ipc-smoke`, `npm run test:stt-smoke`, `npm run test:ai-smoke`, `npm run test:settings-smoke`, `npm run test:remote-setup-smoke`, `npm run test:ai-setup-smoke`, `npm run test:stt-setup-smoke`, `npm run test:linux-install`, `npm run test:package-linux`, `npm run test:docs-links`, `npm run lint`, `npx tsc -p tsconfig.json --noEmit`.
