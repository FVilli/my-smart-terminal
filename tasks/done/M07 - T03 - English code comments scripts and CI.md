---
title: "M07 - T03 - English code comments, scripts and CI"
type: task
project: smart-terminal
created: 2026-10-23
id: "M07-T03"
milestone: "M07"
depends_on: "T02"
deliverables: "English code comments, scripts and CI"
---
<!-- gsynchro:v1 id=7cfcb9c5-a0ca-4119-b584-f7ac6b666372 registered=2026-10-23T10:19:23.499Z -->

# M07 - T03 - English code comments, scripts and CI

## Objective
Remove remaining Italian from non-user-facing code, scripts, tests and CI configuration.

## Constrained implementation
Translate comments, JSDoc, log/error messages, test descriptions, script console output, workflow comments and package metadata descriptions. Preserve identifiers, behavior, payload formats and exit codes. Update tests/smokes if they assert translated messages.

## Acceptance criteria
No Italian text remains in source comments, scripts, tests, workflows or package descriptions; lint, typecheck, unit/integration tests, build and all smokes pass.

## References
apps/**, packages/**, scripts/**, .github/workflows/**.

## Do not
Do not change runtime behavior or public IPC contracts in this task.
