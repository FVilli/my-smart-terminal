---
title: "M01 - T03 - Local PTY runtime"
type: task
project: smart-terminal
created: 2026-10-22
id: "M01-T03"
milestone: "M01"
depends_on: "T02"
deliverables: "Local PTY runtime"
---
<!-- gsynchro:v1 id=4c04f175-2678-433a-b209-a2393f6fc110 registered=2026-10-23T07:57:58.050Z -->

# M01 - T03 - Local PTY runtime

## Objective
Local PTY runtime.

## Constrained implementation
Integrate node-pty for the OS shell in the instance service and stream to xterm.js.

## Acceptance criteria
PTY input/output and resize work; exit is handled.

## Riferimenti
`docs/01 - Architecture.md`; `docs/02 - UI and sessions.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI, voice and security.md`.

## Do not
Do not introduce a database, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: `packages/terminal` (PTY interfaces, local shell file+args, testable `SessionManager`), native `@smart-terminal/terminal/node-pty` adapter, per-window host with cleanup, validated terminal channels/events, typed preload API, Angular xterm component with fit/resize/exit, PTY smoke test.
- Verification: 41 Vitest tests, lint, typecheck, build, `test:ipc-smoke`, and `test:pty-smoke` with output `created/promptOutput/markerSeen/resizeOk/listed/exited/exitEvent=true`.
- Documented deviations: IPC payload limit raised to 128 KiB (validators retain 64 KiB for write data); `handle(sender, ...)` selects the window manager; separate events in `IPC_EVENTS`; `rebuild:native` leaves `node-pty` compiled for Electron (unit tests do not load the binding).
- Contracts and commands recorded in `docs/11 - IPC contracts and runtime verification.md`.
