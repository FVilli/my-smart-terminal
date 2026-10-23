---
title: "M12 - T03 - Independent review and approval"
type: task
project: smart-terminal
created: 2026-10-23
id: "M12-T03"
milestone: "M12"
depends_on: "M12-T02"
deliverables: "Independent review of the matrix/ADR, fixes, approval record and handoff criteria"
---
<!-- gsynchro:v1 id=f6f65a53-b681-4651-99f3-a81e942b5e29 registered=2026-10-23T20:20:48.273Z -->

# M12 - T03 - Independent review and approval

## Objective
Challenge the decision for terminal compatibility, accessibility, safety and non-expert clarity before closing the decision.

## Constrained implementation
- Independent reviewer reads docs/24 and docs/23 and the current implementation evidence; checks that the ADR does not claim impossible Enter interception, protects TUI/SSH behavior, distinguishes histories, and is understandable.
- Apply documentation fixes; record the review outcome in the task.
- Present the decision to the user for explicit approval; do not close M12 before approval. (Approved 2026-10-23.)
- Define the handoff criteria for a future implementation milestone (tests/smokes, focus UX, no PTY interception).

## Acceptance criteria
- Reviewer findings addressed.
- ADR status moves from proposed to accepted only after user approval.
- M12 has no app/release changes.
- Future implementation tests are explicit.

## References
docs/23; docs/24; implementation evidence.

## Do not
Do not implement the decision or publish a release.

## Review record
- Independent review approved Option B and found no reason to intercept terminal Enter: the app cannot observe shell line buffer, raw/TUI mode or SSH application state; keystroke reconstruction fails with readline/cursor editing/paste/TUI.
- Applied corrections: defined focus transition (`Ctrl/Cmd+Shift+E` to composer, Escape back to terminal with draft preserved, explicit click, visible focus, no key stealing); clarified that the app adds no rewriting to xterm `onData` (browser/xterm translation and paste happen before); changed history wording to “eligible for asynchronous app history” and documented filtering/failure; added concrete accessibility/focus assertions.
- Updated `docs/08` from an undefined newline shortcut to the existing Enter/Shift+Enter behavior and terminal key ownership.
- ADR remains **Proposed** pending explicit user approval; M12 must not close before approval and no implementation is authorized by this review.

## Approval
- User explicitly approved Option B on 2026-10-23.
- ADR status changed to **Accepted**; no implementation, runtime behavior, or release change was made.
- M12 decision is closed; future work requires a separate implementation milestone with the ADR test plan.
