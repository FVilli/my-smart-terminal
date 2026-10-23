---
title: "M07 - T04 - Real product screenshots"
type: task
project: smart-terminal
created: 2026-10-23
id: "M07-T04"
milestone: "M07"
depends_on: "T01,T02"
deliverables: "Real product screenshots"
---
<!-- gsynchro:v1 id=52eda538-d43b-4adb-bd27-76b007f793e8 registered=2026-10-23T10:19:23.500Z -->

# M07 - T04 - Real product screenshots

## Objective
Replace mock-only presentation with coherent screenshots of the real application.

## Constrained implementation
Use the Electron capture mode on Xvfb (never the user's desktop) to capture: first-run onboarding, terminal with two tabs and SSH alias menu, assisted input with AI review, History sidebar with filters, clipboard capture controls, sync footer and error/empty states. Store images under docs/assets/screenshots with stable names; update README and docs/12 to use them. Images must match the shipped English UI.

## Acceptance criteria
Screenshots are generated from the real app at 1440x900 and 1024x700 where relevant; README/manual embed only real captures; no mock is presented as a screenshot; images are optimized and committed.

## References
docs/08; docs/12; scripts/capture-layout.mjs; apps/desktop/src/main/capture.ts.

## Do not
Do not use the user's display; do not fabricate UI states that the app cannot produce.
