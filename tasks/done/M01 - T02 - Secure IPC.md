---
title: "M01 - T02 - Secure IPC"
type: task
project: smart-terminal
created: 2026-10-22
id: "M01-T02"
milestone: "M01"
depends_on: "T01"
deliverables: "Secure IPC"
---
<!-- gsynchro:v1 id=586818af-b865-43bf-b920-30494b51c0e3 registered=2026-10-23T07:57:57.171Z -->

# M01 - T02 - Secure IPC

## Objective
Secure IPC.

## Constrained implementation
Typed preload with approved channels and contextIsolation true, nodeIntegration false; validate payloads.

## Acceptance criteria
Renderer without Node; IPC tests for response and rejection of invalid payloads.

## Riferimenti
`docs/01 - Architecture.md`; `docs/02 - UI and sessions.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI, voice and security.md`.

## Do not
Do not introduce a database, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: `ipc.ts` (pure validation, 64 KiB limit, main-frame/origin sender, sanitized errors), `ipc-electron.ts` binding registered once with a tracked window set, `app:ping` and `app:runtime-info` channels, minimal preload, `__testInvoke` seam for smoke only, `smoke.ts`.
- Verification: 12 Vitest tests, lint, typecheck, build, and `npm run test:ipc-smoke` (exit 0), with invalid payload and unknown channel rejected, `require`/`process` undefined in the renderer, and only `ping,runtimeInfo` keys exposed.
- Review deviation/correction: handlers registered once per process and dynamic sender set, to avoid errors with multiple windows.
