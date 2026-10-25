---
title: "M26 - AI surfaces polish"
type: milestone
project: smart-terminal
created: 2026-10-25
id: "M26"
goal: "Polish the AI composer affordance and both AI modals: sparkle-only trigger, larger and better-balanced layouts, and a safe Markdown answer view with a raw toggle."
depends_on: "M25"
---
# M26 - AI surfaces polish

## Fixed decisions
- Composer trigger shows only the sparkles glyph (no "AI" word), keeps `data-testid="ai-correction"` and an accessible name.
- AI Actions manager modal height +10% (720 → 792 px, capped at 90vh); width unchanged.
- AI Assistant modal (composer) uses 90% of the window width and height, with a compact single-row header (title, session/provider context) and no oversized empty band.
- Assistant body is two 50% columns: left = action select, System prompt, User prompt and Send; right = Answer with a Rendered/Raw toggle.
- The Answer uses a new componentized Markdown view (no new dependency, escaped/safe rendering, links restricted to http/https) and a raw read-only textarea view; `Use` keeps working with rendered selection (DOM selection) or raw textarea selection, falling back to the whole answer.
- M20 tokens/utilities, shared primitives, dialog semantics/focus trap/Escape and existing test ids remain; no execution or auto-submit.

## Acceptance
- Sparkle-only composer button; manager modal 10% taller; assistant modal 90vw×90vh, compact header, 50/50 panes at 1440×900, 1024×700 and zoom 50–200 without clipping.
- Answer renders Markdown safely, raw toggle works, `Use` inserts the selection or full answer and never submits; error/sensitive/loading states still visible.
- Tests, smokes (AI/settings), dual-theme layout, screenshots and docs updated; no new dependency.

## Tasks
T01 composer glyph → T02 manager height → T03 assistant layout → T04 Markdown answer + raw toggle + selection → T05 tests/smokes/docs/verification.
