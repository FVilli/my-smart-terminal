---
title: "M14 - T02 - Unified palette"
type: task
project: smart-terminal
created: 2026-10-23
id: "M14-T02"
milestone: "M14"
depends_on: "M14-T01"
deliverables: "Sidebar uses terminal background; history/clipboard cards use input background; visual baseline updated"
---

# M14 - T02 - Unified palette

## Objective
Reduce the number of competing colors and make the shell calmer.

## Constrained implementation
Map the previously black sidebar background to the xterm background `#171e25`; map history/clipboard cards from `#333` to the input background `#222e3c`. Keep text, borders, active tab and accent readable; adjust only variables/derived styles. Update `docs/15 - Visual baseline.md`, capture checks and screenshots.

## Acceptance
Palette measurements match; contrast/readability retained; layout and sidebar smokes/screenshots pass.
