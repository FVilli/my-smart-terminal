---
title: "M21 - T04 - Establish checks and safe refactor inventory"
type: task
project: smart-terminal
created: 2026-10-24
id: "M21-T04"
milestone: "M21"
depends_on: "M21-T03"
deliverables: "Refactor inventory/baseline, static-check configuration and reproducible verification commands"
---
<!-- gsynchro:v1 id=c799e88f-36ad-486a-baca-7bce7455d1a6 registered=2026-10-24T22:31:29.287Z -->

# M21 - T04 - Establish checks and safe refactor inventory

## Objective
Make the written rules actionable before touching implementation.

## Implementation
- Capture current build, typecheck, lint, test and available Linux smoke results; record known failures separately.
- Inventory large classes/functions, duplicated logic, implicit types, brittle RxJS subscriptions, oversized templates, tangled CSS and missing high-value comments.
- Define migration order and ownership boundaries, risk levels and baseline fixtures for UI keyboard/focus, PTY, Git, STT and security.
- Configure existing ESLint/TypeScript/formatter tooling to enforce safe rules incrementally; use baseline or scoped enforcement, not sweeping auto-fixes.
- Preserve dependency lockfile and supported versions; never add lint plugins without a recorded compatibility and approval decision.
- Produce review rubric: behavior preservation, naming, clarity, necessity of abstraction, comments, tests, and diff size.

## Acceptance
Reproducible baseline, prioritized worklist and executable checks exist; work does not start with pre-existing failures misrepresented as new regressions.
