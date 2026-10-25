---
title: "M25 - T03 - Add the dedicated AI Actions modal and header icons"
type: task
project: smart-terminal
created: 2026-10-25
id: "M25-T03"
milestone: "M25"
depends_on: "M25-T02"
deliverables: "AI Actions modal opened from the header, and the new header icon order"
---
# M25 - T03 - Add the dedicated AI Actions modal and header icons

## Implementation
- New modal wrapper rendering `<app-ai-actions-settings />` as its body, with header title, close/Cancel footer, dialog semantics, focus trap/Escape and focus return to the wand button; sizes `min(1000px,94vw)` × `min(720px,90vh)`, internal scroll.
- Open state in a small store signal (or extend the existing AI actions settings context) triggered by a new header wand button (`data-testid="ai-actions-open"`, aria-label "AI actions").
- Header actions order: wand, Settings wrench (replace ⚙ with a wrench SVG, keep `settings-open`), layout toggle (`header-panel-toggle`); window controls unchanged.
- Remove the editor from settings entirely (T01) and ensure the modal is rendered once in the app shell.
- Keep tokens/utilities, no palette literals; focus ring and aria; no PTY implications.
## Acceptance
- Header order and icons as specified; AI Actions open in the dedicated modal from anywhere and close with Escape/Cancel; settings has no AI Actions; layout/tests green.
