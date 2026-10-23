---
title: "M08 - T04 - Responsive and visual regression checks"
type: task
project: smart-terminal
created: 2026-10-23
id: "M08-T04"
milestone: "M08"
depends_on: "T03"
deliverables: "Responsive and visual regression checks"
---
<!-- gsynchro:v1 id=2d04d1f6-42af-43b8-af47-74fe647e5846 registered=2026-10-23T12:22:14.924Z -->

# M08 - T04 - Responsive and visual regression checks

## Objective
Make the visual contract testable and protect it from regressions.

## Constrained implementation
Extend the capture/layout tests to verify 75/25, no overflow, minimum tab/input/footer dimensions and key palette samples at 1440x900 and 1024x700. Keep screenshots available as artifacts but do not fail on tiny antialiasing differences. Add an explicit `npm run test:layout` (or equivalent) gate used by CI and the release workflow.

## Acceptance criteria
The layout test fails when the split, overflow or target colors/heights regress; it passes on the implemented layout; CI runs it on Linux; screenshots are generated on Xvfb and never on the user display.

## References
scripts/capture-layout.mjs; apps/desktop/src/main/capture.ts; .github/workflows/ci.yml.

## Do not
Do not use brittle pixel-perfect full-image diffing.
