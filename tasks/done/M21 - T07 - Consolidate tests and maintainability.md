---
title: "M21 - T07 - Consolidate tests and maintainability"
type: task
project: smart-terminal
created: 2026-10-24
id: "M21-T07"
milestone: "M21"
depends_on: "M21-T06"
deliverables: "Lean, deterministic characterization tests and updated maintenance documentation"
---
<!-- gsynchro:v1 id=7ce44ecd-530e-4821-ba03-057916e12eb5 registered=2026-10-24T22:31:29.289Z -->

# M21 - T07 - Consolidate tests and maintainability

## Objective
Make the refactor resilient and remove brittle test duplication.

## Implementation
- Review test names, fixtures, mocks and helper reuse; remove duplicated setup only without losing case coverage.
- Assert observable contracts rather than private implementation details, especially Angular UI, keyboard/focus, IPC and concurrency.
- Add missing regression tests for issues discovered during T05/T06.
- Eliminate dead tests only with evidence they duplicate coverage; retain failure-path and platform-specific cases.
- Update docs/26–28 examples and the review checklist to reflect proven patterns, without weakening standards.

## Acceptance
Test suite deterministic with equivalent or stronger meaningful coverage; no business changes; changes tracked in task outcome.
