---
title: "M24 - T07 - Scout appearance customization options"
type: task
project: smart-terminal
created: 2026-10-25
id: "M24-T07"
milestone: "M24"
depends_on: "M23"
deliverables: "Scouting report of current appearance code, feasible options, constraints and risks (scout + oracle)"
---

# M24 - T07 - Scout appearance customization options

## Implementation
- Scout the renderer appearance/styling architecture (appearance-store, M20 tokens, xterm theme in terminal-panel, Tailwind usage, zoom, onboarding/assisted input) and the docs (15/28).
- Produce `docs/38 - Appearance customization scouting.md`: current configurable surface (terminal font only), candidate options (light/dark theme, UI font, font size, line height, density, accent, terminal color scheme/cursor, transparency), where each is implemented today, token/contrast implications, persistence location, migration, test/visual-baseline impact, effort/risk.
- Consult the oracle on scope sequencing and risks (theme vs per-surface customization) and record its position.
- Explicitly separate low-risk (font size/UI font) from high-risk (light theme, terminal palettes) and recommend a first approved set.

## Acceptance
- Evidence-based scouting doc with paths, options, risks, recommended scope; no code changes.
