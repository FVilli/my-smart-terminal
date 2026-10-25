---
title: "M30 - T03 - Migrate every component to the design system"
type: task
project: smart-terminal
created: 2026-10-25
id: "M30-T03"
milestone: "M30"
depends_on: "M30-T02"
deliverables: "Components without local design styles; justified exceptions documented"
---
# M30 - T03 - Migrate every component to the design system

## Implementation
Remove component `styles:` blocks/inline styles/palette literals/`!important`; replace ad-hoc patterns with primitives; keep layout utilities. Document justified exceptions (xterm internals, scrollbars, third-party DOM).
## Acceptance
- Automated guard flags zero component-owned design styles outside the allowlist; behaviour/test ids unchanged.
