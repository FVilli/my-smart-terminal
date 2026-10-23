---
title: "M08 - T01 - Visual audit and measurements"
type: task
project: smart-terminal
created: 2026-10-23
id: "M08-T01"
milestone: "M08"
depends_on: ""
deliverables: "Visual audit and measurements"
---
<!-- gsynchro:v1 id=8e1fd66b-a38f-4a84-9b83-1a5c6014d6cd registered=2026-10-23T12:22:14.921Z -->

# M08 - T01 - Visual audit and measurements

## Objective
Produce a concrete visual audit of the approved mock versus the current real screenshots.

## Constrained implementation
Measure the mock and the current app: 75/25 split, header/tab heights, active/inactive tab colors, sidebar background/cards, input height and margins, footer height/background, terminal background, typography and spacing. Record the target values in a short English reference (docs or task notes) and add a repeatable capture/comparison script where useful. Do not redesign the mock.

## Acceptance criteria
A side-by-side audit exists with numeric targets and current deltas; the audit covers at least the six states in docs/assets/screenshots; the measurement method is repeatable (screenshots + pixel sampling/DOM metrics); no subjective-only claims.

## References
mockups/Smart Terminal - final mock.png; docs/02; docs/08; apps/desktop/src/main/capture.ts; scripts/capture-screenshots.mjs.

## Do not
Do not change runtime behavior in this task.
