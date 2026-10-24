---
title: "M20 - T03 - Define semantic tokens and shared controls"
type: task
project: smart-terminal
created: 2026-10-24
id: "M20-T03"
milestone: "M20"
depends_on: "M20-T02"
deliverables: "Documented token mapping and reusable Angular control styles"
---
<!-- gsynchro:v1 id=87612419-7e11-43c3-98d8-95352ed3f3ad registered=2026-10-24T17:27:34.756Z -->

# M20 - T03 - Define semantic tokens and shared controls

## Objective
Introduce one visual language that maps the existing baseline to Tailwind utilities.

## Implementation
- Encode the palette from `docs/15 - Visual baseline.md` as semantic CSS custom properties, including terminal, tab, active tab, input, sidebar, card, border, text, muted text and accent.
- Expose tokens to Tailwind 4 theme utilities; define shared spacing, radius, sizing and focus conventions, using existing approved geometry rather than inventing a redesign.
- Consolidate repeated button, icon action, tab and panel styling through reusable Angular components or narrowly scoped style patterns where already present; preserve labels/ARIA.
- Document ownership and exceptions: token values in one file, limited component CSS, dedicated xterm stylesheet.

## Acceptance
No token divergence from baseline, all new controls use semantic tokens, focus-visible remains observable and theme documentation matches code.
