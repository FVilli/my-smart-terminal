---
title: "M30 - Design system adoption sweep"
type: milestone
project: smart-terminal
created: 2026-10-25
id: "M30"
goal: "Audit the whole renderer for component-local styling, extend the design system where patterns repeat, and adopt it so components stop defining their own visual styles."
depends_on: "M29"
---
# M30 - Design system adoption sweep

## Fixed decisions
- Tailwind utilities remain allowed for layout/composition; the target is removal of component-owned design decisions: `styles:` blocks, inline `style=`, palette literals, one-off label/field/panel/button styles, arbitrary px/color values duplicating tokens, and `!important`.
- Audit is exhaustive and parallel by area (AI, settings/onboarding, shell/terminal, global styles). Findings must include file:line and a proposed primitive.
- Extend `styles.css` primitives only for patterns repeated at least twice; migrate all components to them; document residual justified exceptions (xterm canvas, scrollbars, third-party DOM).
- No behaviour/test-id/contract/security changes.

## Acceptance
- Audit report with full inventory and disposition (migrated / new primitive / justified exception).
- No component `styles:` block with design values, no inline style, no palette literal, no `!important`; duplicated label/field/panel/button patterns replaced by primitives.
- Gates, smokes, layout, screenshots and independent review green.

## Tasks
T01 parallel audit → T02 extend primitives → T03 migrate components → T04 verify + audit.
