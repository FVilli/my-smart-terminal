---
title: "M09 - T01 - Settings entry and reversible wizard"
type: task
project: smart-terminal
created: 2026-10-23
id: "M09-T01"
milestone: "M09"
depends_on: "M08-T03"
deliverables: "Settings entry and reversible wizard"
---
<!-- gsynchro:v1 id=4f85f9c0-41ff-421c-8c0a-52f3194a5dbe registered=2026-10-23T12:22:28.373Z -->

# M09 - T01 - Settings entry and reversible wizard

## Objective
Let users reopen configuration at any time and move through the wizard without losing work.

## Constrained implementation
Add a visible settings control (gear icon in the header, with accessible label/tooltip) that opens the existing wizard in edit mode, preloaded with the current config. Keep Back/Next on every step where meaningful, Cancel/Close always available, validation per step, dirty-state preservation and Escape handling. Do not trap focus outside the dialog; return focus to the opener on close. On save, apply non-restart settings immediately and show restart guidance only for repo/machine/remote changes.

## Acceptance criteria
Settings can be opened from the main UI and from the wizard after onboarding; Back/Next/Cancel behave consistently; values survive navigation; reopening shows saved values; Escape closes without saving; focus is restored; onboarding smoke covers reopen/back/forward/cancel.

## References
apps/renderer/src/app/onboarding; apps/renderer/src/app/header; docs/14.

## Do not
Do not require an app restart for AI/STT-only changes.
