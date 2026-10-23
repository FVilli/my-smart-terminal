---
title: "M02 - T02 - Multi-session tabs"
type: task
project: smart-terminal
created: 2026-10-22
id: "M02-T02"
milestone: "M02"
depends_on: "T01"
deliverables: "Multi-session tabs"
---
<!-- gsynchro:v1 id=4091757f-4ba7-4ee8-a766-f1ec5da7f7c4 registered=2026-10-23T07:57:59.382Z -->

# M02 - T02 - Multi-session tabs

## Objective
Multi-session tabs.

## Constrained implementation
Create/activate/close a PTY per tab, separate drafts, background running.

## Acceptance criteria
Two independent sessions; switching does not kill processes.

## Riferimenti
`docs/01 - Architecture.md`; `docs/02 - UI and sessions.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI, voice and security.md`.

## Do not
Do not introduce a database, additional remote services, or architectural choices not specified.


## Outcome
- 2026-10-23: completed.
- Implemented: `SessionsStore` (sessions, activeId, drafts, errors, output buffer), persistent xterm panels hidden via CSS, local creation from `+`, switch/close with inline confirmation, empty/error state, S<n> labels per window.
- Verification: `npm run test:tabs-smoke` with `twoTabs`, `panelsMounted`, `switchKeepsSessions`, `closedOne` all true; 46 Vitest tests; build/lint/typecheck passed.
- Note: S<n> labels are temporary per window; M03 will replace them with persistent atomic IDs.
