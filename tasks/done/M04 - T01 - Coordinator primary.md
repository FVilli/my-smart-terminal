---
title: "M04 - T01 - Primary coordinator"
type: task
project: smart-terminal
created: 2026-10-22
id: "M04-T01"
milestone: "M04"
depends_on: ""
deliverables: "Primary coordinator"
---
<!-- gsynchro:v1 id=1f499c0e-15a9-47ca-8089-00cb4e1aa1bb registered=2026-10-23T07:58:05.254Z -->

# M04 - T01 - Coordinator primary

## Objective
Coordinator primary.

## Constrained implementation
Local lock/leader, client-secondary IPC, heartbeat, and takeover after a crash.

## Acceptance criteria
One primary instance per machine and a correct UI indicator.

## References
`docs/01 - Architecture.md`; `docs/02 - UI and sessions.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI, voice and security.md`.

## Do not
Do not introduce databases, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: election with lock/heartbeat/stale recovery, Unix socket/named pipe server with token and a whitelisted JSON protocol, client with token reread, primary/secondary orchestrator with takeover, remote allocator and switching, main integration, `isPrimary` + role event, and dynamic footer.
- Verification: 203 tests (multi-process, 8 concurrent elections, kill -9 with takeover, token/method/oversize, permissions), `test:coordinator`, all smoke tests; IPC smoke with `isPrimary:true` and primary indicator.
- Deviations: fallback to the file allocator if the primary is unreachable (shared lock, no blocking); synchronous lock release on `process.exit` for smoke tests; socket path limit of ~108 characters (M06).
