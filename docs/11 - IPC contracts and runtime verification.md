---
title: "IPC contracts and runtime verification"
type: contract
project: smart-terminal
version: 2
created: 2026-10-23
---

# IPC contracts and runtime verification

This document describes the current main/preload/renderer contract. The shared normative definitions are in `packages/contracts/src/index.ts`; configuration behavior is in `docs/10 - Local config, coordinator and runtime security.md`.

## Security rules

- `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`; the renderer cannot access `require` or `process`.
- Production preload exposes only typed, whitelisted methods. There is no generic invoke API.
- Main validates channel, payload keys/types/limits, tracked main-frame sender, and exact origin. Errors are coded and sanitized.
- JSON payloads are limited to 128 KiB; PTY writes are limited to 64 KiB and terminal dimensions to 1–1000.
- Main-to-renderer events are separate from invokable channels and support unsubscribe.

## Invokable channels

| Channel | Request | Result |
| --- | --- | --- |
| `app:ping` | none | `{ appVersion, platform }` |
| `app:runtime-info` | none | `{ appVersion, platform, isPackaged, isPrimary }` |
| `terminal:create` | `{ kind: 'local'|'ssh', sshAlias?, cwd?, cols?, rows? }` | `TerminalSessionInfo` |
| `terminal:write` | `{ sessionId, data }` | `void` |
| `terminal:resize` | `{ sessionId, cols, rows }` | `void` |
| `terminal:close` | `{ sessionId }` | `void` |
| `terminal:list` | none | `TerminalSessionInfo[]` |
| `history:record` | `{ sessionId, text, agent? }` | `{ recorded: boolean }` |
| `clipboard:state` | none | clipboard state |
| `clipboard:configure` | `{ enabled, paused }` | clipboard state |
| `clipboard:set-active` | `{ sessionId: string \| null }` | `void` |
| `clipboard:clear` | none | `void` |
| `clipboard:write` | clipboard entry request | `void` |
| `search:query` | query and optional machine/session/date/kind filters | capped search results |
| `search:facets` | none | search facets |
| `sync:get-status` | none | sync status |
| `ssh:aliases` | none | parsed SSH aliases |
| `onboarding:state` | none | config, reason, secure-storage and secret status |
| `onboarding:validate` | `{ config: OnboardingConfig }` | validation result |
| `onboarding:save` | config plus optional AI/STT token | save result |
| `onboarding:skip` | none | save result with defaults |
| `setup:test-remote` | `OnboardingConfig` | remote setup result |
| `setup:test-ai` | `{ config: OnboardingConfig, aiToken? }` | `{ ok, provider, model?, latencyMs?, error? }` |
| `help:open` | help topic | `void` |
| `secrets:status` / `secrets:logout` | provider key as applicable | secret status |
| `app:relaunch` | none | `void` |
| `window:control` | `'minimize' \| 'toggle-maximize' \| 'close'` | `void` |
| `ai:status` / `ai:correct` | status or `{ text }` | AI status or correction result |
| `stt:status` / `stt:transcribe` | status or `{ audio: Uint8Array, mimeType }` | STT status or `{ text, skipped, reason? }` |

Main-to-renderer events are `terminal:data`, `terminal:exit`, `app:role-changed`, `sync:status`, `search:refreshed`, and `window:maximized` (`{ maximized: boolean }`).

## Preload API

The typed preload API mirrors these channels: terminal lifecycle and data listeners, history/clipboard/search, sync and role status, SSH aliases, onboarding/setup, secrets/help/relaunch, window controls, AI, and STT. The `__testInvoke` seam exists only with `--smart-terminal-test-ipc` and is used by smoke tests.

## Configuration and setup contracts

AI setup uses the current unsaved `OnboardingConfig` and an optional token supplied in the form. `setup:test-ai` validates the configuration in the main process, uses the supplied token or stored token, never returns the token, and returns a sanitized success or failure result. The test is a fixed minimal request and never executes commands.

STT results may include a sanitized `SttDiagnostics` object (stage, serviceReached, HTTP status, content type, JSON validity, elapsed time, endpoint, model, language, audio metadata and text length). Cloud STT configuration includes `sttBaseUrl`, `sttResponseFormat` (`json` or `verbose_json`), `sttLanguage`, and `sttUseAiProvider`. When `sttUseAiProvider` is true, the AI base URL and `ai:<provider>` token are used and the separate STT token is unnecessary. The base URL must be an HTTP(S) URL without credentials or query parameters. STT audio is validated in main, is limited to 10 MiB per request, and is never persisted.

Window controls accept only `minimize`, `toggle-maximize`, or `close`. The renderer receives `window:maximized` after maximize-state changes; controls are not implemented as arbitrary window commands.

## Runtime behavior

- History records explicit assisted-editor submissions only; keystrokes and TUI prompts are not recorded.
- Clipboard capture is opt-in, supports pause/clear, polls about every 800 ms, caps entries at 32 KiB, hashes/deduplicates, and associates entries with the active session.
- Search is case-insensitive, in-memory, rebuilt at startup, refreshed after Git, and capped at 100 results.
- The coordinator serializes session allocation, search, clipboard, and Git operations. The primary publishes role and sync status; secondary windows remain usable.
- The renderer has a real PTY surface and a separate composer. Enter submits, Shift+Enter inserts a newline, and only the documented application zoom shortcuts are intercepted globally.

## Smoke and verification commands

| Command | Verification |
| --- | --- |
| `npm run test:ipc-smoke` | API exposure, valid calls, payload/channel rejection, renderer without Node |
| `npm run test:ai-setup-smoke` | unsaved AI values, token handling, main-only validation and sanitized results |
| `npm run test:stt-setup-smoke` | STT URL/format/language validation and setup flow |
| `npm run test:stt-smoke` | bounded audio, deterministic transcription path, no real API |
| `npm run test:settings-smoke` | Settings tabs and unsaved/save behavior |
| `npm run test:editor-smoke` | Enter/Shift+Enter, successful submission, per-tab drafts |
| `npm run test:sidebar-smoke` | History/Clipboard toggles and footer status |
| `npm run test:layout` | 35 px full-window header, 38 px tabs, composer/sidebar layout |
| `npm run test` | unit and integration contract coverage |

Linux Electron smoke tests run under the Xvfb wrapper in `scripts/run-electron.mjs`; use the repository's npm scripts rather than launching a test window on the desktop.
