---
title: "M30 - T01 - Audit all renderer styling in parallel"
type: task
project: smart-terminal
created: 2026-10-25
id: "M30-T01"
milestone: "M30"
depends_on: "M29"
deliverables: "Per-area style inventory with proposed primitives"
---
# M30 - T01 - Audit all renderer styling in parallel

## Implementation
Four read-only auditors: AI surfaces; settings/onboarding; shell/terminal; global styles. Each lists component `styles:` blocks, inline styles, palette literals, `!important`, ad-hoc label/field/button/panel/badge/toolbar classes, arbitrary values duplicating tokens, and duplicated patterns, with file:line and a proposed primitive.
## Acceptance
- Aggregated inventory with categories and counts; no code changes.
