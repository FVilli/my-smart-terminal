---
title: "M03 - T02 - Atomic ID allocation"
type: task
project: smart-terminal
created: 2026-10-22
id: "M03-T02"
milestone: "M03"
depends_on: "T01"
deliverables: "Atomic ID allocation"
---
<!-- gsynchro:v1 id=1799c10c-9db0-4741-b778-365e83e7ec33 registered=2026-10-23T07:58:02.270Z -->

# M03 - T02 - Atomic ID allocation

## Objective
Atomic ID allocation.

## Constrained implementation
Request a per-machine sequence via lock, do not reuse IDs; support simultaneous windows.

## Acceptance criteria
Two concurrent requests receive different S values; restart continues.

## Riferimenti
`docs/01 - Architecture.md`; `docs/02 - UI and sessions.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI, voice and security.md`.

## Do not
Do not introduce a database, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: `FileSessionIdAllocator` with atomic directory lock, owner/nonce, stale recovery, `sessions/<machine>/counter.md` counter reserved before use, directory bootstrap, collision handling, guaranteed lock release; `DataRuntime` and `TerminalHost` integration (async create, `ended_at`, persistent IDs).
- Verification: 101 Vitest tests; concurrency of 10 in-process and 3 processes × 6 allocations without duplicates; restart/corrupt counter/stale lock; ipc/pty/tabs/layout/editor/sidebar smoke tests passed.
- Note: on spawn failure the directory remains with `ended_at` and the consumed ID is not reused; documented.
