---
title: "M21 - T08 - Independently verify pure refactoring"
type: task
project: smart-terminal
created: 2026-10-24
id: "M21-T08"
milestone: "M21"
depends_on: "M21-T07"
deliverables: "Independent audit report, test evidence, documented exceptions and completion decision"
---
<!-- gsynchro:v1 id=07ee4a45-b339-4a7c-a544-762e7b58b0fe registered=2026-10-24T22:31:29.290Z -->

# M21 - T08 - Independently verify pure refactoring

## Objective
Prove M21 did not change externally observable behavior and workers complied with its rules.

## Implementation
- Independently inspect changes vs M20 baseline, forbidden API/data/styling/dependency changes and comment usefulness.
- Run repo lint, typecheck, unit/build, renderer smoke; use applicable Linux package and multi-instance/terminal/STT verification scenarios.
- Validate keyboard focus/shortcuts, PTY, IPC permissions, Git primary instance, error and cleanup paths; distinguish automated tests from manual hardware/provider checks.
- Compare visual baselines at documented resolutions and zoom settings; document any approved tolerances.
- Report changed file counts, removed dead code/duplication, rule compliance, regression results, known limitations and follow-up backlog.
- Do not mark M21 done while required gates are failing; document genuine pre-existing failures separately.

## Acceptance
Evidence-backed independent review, no unapproved functional change, all required gates green or explicitly blocked; all M21 tasks in `done` before milestone closure.
