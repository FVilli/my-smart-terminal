---
title: "M02 - T01 - Baseline layout"
type: task
project: smart-terminal
created: 2026-10-22
id: "M02-T01"
milestone: "M02"
depends_on: ""
deliverables: "Layout baseline"
---
<!-- gsynchro:v1 id=5722cf14-6295-425e-b842-b6d4145ba0d1 registered=2026-10-23T07:57:58.618Z -->

# M02 - T01 - Baseline layout

## Objective
Baseline layout.

## Constrained implementation
Replicate the mock: 75/25, dark theme, monospace font, tabs, sidebar.

## Acceptance criteria
Visual comparison with the mock, no overflow on resize.

## Riferimenti
`docs/01 - Architecture.md`; `docs/02 - UI and sessions.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI, voice and security.md`.

## Do not
Do not introduce a database, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: 75/25 shell with standalone `app-header`, `session-tabs`, `terminal-workarea`, `assisted-input`, `sidebar-panel`, `status-footer` components; mock palette, monospace font, `min-width:0` columns, input/footer in the left column, full-height sidebar.
- Verification: `npm run test:layout` at 1440x900 and 1024x700 with 0.75 ratio, `overflow:false`, screenshots in `dist/layout/`; lint/typecheck/build/test passed.
- Note: header added during parent review to comply with the hierarchy in `docs/08`.
