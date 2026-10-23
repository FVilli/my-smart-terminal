---
title: "M04 - T02 - Serialized Git engine"
type: task
project: smart-terminal
created: 2026-10-22
id: "M04-T02"
milestone: "M04"
depends_on: "T01"
deliverables: "Serialized Git engine"
---
<!-- gsynchro:v1 id=fdeb2f63-26f3-41e2-81f0-6cad06eca6fa registered=2026-10-23T07:58:06.033Z -->

# M04 - T02 - Serialized Git engine

## Objective
Serialized Git engine.

## Constrained implementation
Clone/init repository, session-scoped commits, fetch/rebase/push with mutex/backoff/offline handling.

## Acceptance criteria
No force push; recovery from two concurrent commits and offline operation.

## References
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce databases, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: `GitEngine` with execFile, init/remote/branch, staging and commits limited to `sessions/`, fetch/rebase/push with retry/backoff and mutex, conflicts with abort and preserved files, status and error sanitization, no force push; `GitSyncManager` with dirty notification and explicit sync.
- Verification: 14 Git tests on a bare repository and two simulated machines (cross-sync, concurrent commits, rejected push, conflict, offline, no empty commits, limited staging, no `--force`).
- Note: without a remote, commits remain local; the "repository not configured" UI arrives in T04.
