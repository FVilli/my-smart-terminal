---
title: "M22 - T05 - Apply AI answers to the composer"
type: task
project: smart-terminal
created: 2026-10-25
id: "M22-T05"
milestone: "M22"
depends_on: "M22-T04"
deliverables: "Use/Cancel/Close semantics with selection-aware insertion at the caret into the editable draft"
---

# M22 - T05 - Apply AI answers to the composer

## Objective
Make the reviewed answer usable without ever sending or executing it, and make the footer actions unambiguous.

## Implementation
- Extract the existing insert-at-caret logic from the composer into a small shared helper used by both STT transcript insertion and the modal hand-off (single implementation, same caret/selection semantics, undo-friendly).
- `Use`: insert the selected portion of the read-only answer, or the whole answer when nothing is selected, at the composer caret; close the modal; focus returns to the composer; the draft stays editable and is not submitted. Empty/whitespace answers disable `Use`.
- `Cancel`: close and discard prompt + answer for that session draft; `Close`: close and keep the prompt so reopening restores it; document the distinction in the design doc and UI copy.
- Prompt/answer are not written to Markdown or logs; reopening without a preserved prompt starts clean.
- Selection handling: normalize line endings, preserve leading/trailing whitespace of the selected block, cap insertion at the composer size limit and report a message instead of truncating silently.
- Keep per-session awareness: switching the active session while the modal is open closes it or re-targets it to the new session (choose one in T01 and test it).
- Tests: unit tests for the insertion helper (caret, selection, multi-line, empty) and a smoke that uses the test-mode answer, presses `Use`, and asserts draft content with no submission; `Cancel`/`Close` states asserted too.

## Acceptance
- `Use` inserts exactly the selected text (or full answer) at the caret, closes the modal and never submits.
- `Cancel`/`Close` follow the agreed semantics; focus returns to the composer in all cases.
- The shared insertion helper replaces the private composer implementation without behaviour change for STT.
- Tests, lint, typecheck and build pass; M20 layout and input-contract smokes stay green.
