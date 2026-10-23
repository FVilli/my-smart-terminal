---
title: "M02 - T04 - Dual sidebar"
type: task
project: smart-terminal
created: 2026-10-22
id: "M02-T04"
milestone: "M02"
depends_on: "T01"
deliverables: "Dual sidebar"
---
<!-- gsynchro:v1 id=74577c89-ed0a-4873-b87e-6468e0c8f9f7 registered=2026-10-23T07:58:00.806Z -->

# M02 - T04 - Dual sidebar

## Objective
Dual sidebar.

## Constrained implementation
Alternative Clipboard/History tabs; search and filters; sync/primary footer component.

## Acceptance criteria
Correct tab switching and status placeholders.

## Riferimenti
`docs/01 - Architecture.md`; `docs/02 - UI and sessions.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI, voice and security.md`.

## Do not
Do not introduce a database, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: `sidebarTab` signal, Clipboard/History switching with aria-selected, enabled search/machine filter (static data), distinct placeholders, footer with labels for the four states and primary indicator, layout test extended for sidebar overflow.
- Verification: sidebar smoke with defaultClipboard, historySelected, clipboardSelected, placeholdersDiffer, controlsEnabled, syncLabel, primaryIndicator, noSidebarOverflow; 0.75 layout without overflow at two viewports.
- Note: real sidebar data and dynamic sync/primary state arrive in M03/M04.
