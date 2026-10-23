---
title: "M04 - T03 - Debounce and polling"
type: task
project: smart-terminal
created: 2026-10-22
id: "M04-T03"
milestone: "M04"
depends_on: "T02"
deliverables: "Debounce and polling"
---
<!-- gsynchro:v1 id=8dc20d5f-32f8-46f5-9750-6aef12829bce registered=2026-10-23T07:58:06.836Z -->

# M04 - T03 - Debounce and polling

## Objective
Debounce and polling.

## Constrained implementation
Dirty events, 10s debounce, 60s maximum, 15s fetch; start/stop handling.

## Acceptance criteria
Fake-timer tests for triggers, no empty commits.

## References
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce databases, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: `SyncScheduler` (10 s debounce, 60 s maximum wait, 15 s fetch, coalescing, flush/stop), serialized `GitEngine.fetchOnly()`, `GitSyncManager` with start/stop/flush and `remoteConfigured`, main wiring with env, and `sync:status` event.
- Verification: 225 tests (13 fake timers + Git fetchOnly/manager) and `test:coordinator`; tsc/lint/build/smoke passed.
- Deviation: flush on closure of an individual session is not explicit; session end sends a dirty notification, and flush occurs on runtime stop or app closure (5 s timeout).
