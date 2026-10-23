---
title: "M06 - T01 - Multi-instance E2E"
type: task
project: smart-terminal
created: 2026-10-22
id: "M06-T01"
milestone: "M06"
depends_on: ""
deliverables: "Multi-instance E2E"
---
<!-- gsynchro:v1 id=2a18c792-e376-4a02-ae0d-67f220b8cda8 registered=2026-10-23T07:58:10.810Z -->

# M06 - T01 - Multi-instance E2E

## Objective
Multi-instance E2E.

## Constrained implementation
Concurrent instance tests, session IDs, primary failover, and simulated cross-machine sync.

## Acceptance criteria
All cases pass using file fixtures and local Git.

## References
`docs/01 - Architecture.md`; `docs/02 - UI and sessions.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI, voice and security.md`.

## Do not
Do not introduce databases, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: main E2E mode (`SMART_TERMINAL_E2E_MODE` same-machine/cross-machine, READY/ROLE/SEARCH), `scripts/e2e-multi-instance.mjs` script, `test:e2e`.
- Verification: two real Electron instances on Xvfb; one primary, distinct sessionIds, Markdown files present; SIGKILL of the primary + secondary takeover; cross-machine with a bare remote and a visible marker without local writes.
- Review correction: the script killed only the Node wrapper, leaving Electron and the lock alive; it now uses a dedicated process group (`detached` + negative kill) and waits for takeover.
