---
title: "M21 - T03 - Define comment and documentation policy"
type: task
project: smart-terminal
created: 2026-10-24
id: "M21-T03"
milestone: "M21"
depends_on: "M21-T02"
deliverables: "docs/28 - Code comments and maintainability.md with documented comment examples"
---
<!-- gsynchro:v1 id=5bb5e2db-538f-40f3-bf81-c877de76dc17 registered=2026-10-24T22:31:29.286Z -->

# M21 - T03 - Define comment and documentation policy

## Objective
Improve readability with useful comments, not comment noise.

## Implementation
- Specify JSDoc/TSDoc for exported non-obvious APIs, contracts, parameter constraints and domain invariants.
- Require concise explanation of *why* for concurrency, IPC trust boundaries, PTY/xterm input, Git coordination, state transitions, cleanup and STT/AI error paths.
- Comments explain intent, edge cases, invariants and reasoning, never merely restate obvious lines.
- Remove misleading/obsolete comments; prohibit commented-out code, vague TODOs, redundant narration or information likely to drift.
- TODO/FIXME references must contain an actionable issue/task link and reason; document meaningful decisions in docs/ADR rather than large inline essays.
- English documentation and comments consistent with existing release conventions; only touch neighboring comments in scoped changes.

## Acceptance
Policy shows concise good/bad examples and defines what must, may and must not be commented; all workers can apply it without design choices.
