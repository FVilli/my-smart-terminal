---
title: "M08 - T02 - Application shell alignment"
type: task
project: smart-terminal
created: 2026-10-23
id: "M08-T02"
milestone: "M08"
depends_on: "T01"
deliverables: "Application shell alignment"
---
<!-- gsynchro:v1 id=4d0fb304-1a10-4de0-9080-412f07adec4b registered=2026-10-23T12:22:14.922Z -->

# M08 - T02 - Application shell alignment

## Objective
Align the main shell (header, tab bar, terminal area, sidebar, assisted input, footer) with the approved mock measurements.

## Constrained implementation
Implement the target proportions and palette from T01: 75/25 grid with min-width/min-height 0; header/tab structure; taller tab bar with distinct active/inactive colors; black/very dark sidebar with #333 cards; taller assisted input; thin footer on terminal background; terminal #171e25; consistent borders/spacing. Keep the sidebar full height and all content scrollable. Reserve the header settings slot but hide it until M09-T01 (do not render a disabled placeholder). Preserve xterm fit/resize and existing data-testid behavior.

## Acceptance criteria
DOM metrics at 1440x900 and 1024x700 show 75/25 ±0.02, no overflow, tab/input/footer heights within the documented targets; active tab and sidebar colors sampled from screenshots match the target palette; terminal/input use monospace; no session switching or PTY behavior changes.

## References
mockups/Smart Terminal - final mock.png; docs/02; docs/08; apps/renderer/src/app/{app,header,session-tabs,assisted-input,status-footer,terminal-workarea}.

## Do not
Do not add features or change IPC/PTY behavior.
