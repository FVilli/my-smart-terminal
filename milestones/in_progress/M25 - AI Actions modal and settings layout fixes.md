---
title: "M25 - AI Actions modal and settings layout fixes"
type: milestone
project: smart-terminal
created: 2026-10-25
id: "M25"
goal: "Move AI Actions out of Settings into a dedicated modal opened from the header, refine its list/footer and custom-action deletion, and resize the settings dialog now that the editor is gone."
depends_on: "M24"
---

# M25 - AI Actions modal and settings layout fixes

## Fixed decisions
- **Settings dialog**: height increases by 20% (`min(744px, 90vh)`) while the width shrinks from 832 px to `min(640px, 92vw)` now that AI Actions is not a tab; fixed body scroll and pinned footer remain.
- **Settings tabs**: back to Repository / AI / STT / Appearance (the AI Actions tab and component are removed from the wizard).
- **AI Actions modal**: dedicated modal opened from the header wand icon, rendering the existing editor/list at `min(1000px, 94vw)` and `min(720px, 90vh)`; closes via Cancel/Close, Escape and focus returns to the wand button.
- **List footer**: only the top border, no different background; the bulk Reset button is removed; a very small counter shows `BUILT-IN:<n> CUSTOM:<n>`.
- **Delete**: custom actions can be deleted behind a confirmation dialog; built-ins cannot be deleted; per-action Reset for built-ins stays.
- **Header order**: `[AI Actions wand] [Settings wrench] [layout toggle]`, with existing window controls unchanged; stable test ids (`ai-actions-open`, `settings-open`, `header-panel-toggle`) and accessible names.
- Frontend remains componentized with M20 tokens and the shared primitives; no palette literals.

## Acceptance
- Settings is 20% taller and narrower, 4 tabs, no overflow at 1024×700/zoom.
- AI Actions open in their own modal from the header; settings no longer lists them.
- Footer has the line, transparent background and the built-in/custom counter; Reset bulk control is gone.
- Deleting a custom action requires confirmation; built-ins are protected.
- Header shows wand, wrench, toggle in that order with correct labels; smokes/tests/docs/screenshots updated; lint/typecheck/tests/build/layout green.

## Tasks
T01 settings geometry + tab removal → T02 editor footer/delete/counter → T03 dedicated modal + header icons → T04 tests, smokes, docs and verification.
