---
title: "M24 - T08 - Design the approved appearance set"
type: task
project: smart-terminal
created: 2026-10-25
id: "M24-T08"
milestone: "M24"
depends_on: "M24-T07"
deliverables: "Approved design (tokens, persistence, settings UI, light/dark) ready for implementation"
---

# M24 - T08 - Design the approved appearance set

## Implementation
- Based on T07 and oracle guidance, write `docs/39 - Appearance customization design.md`: approved options for this milestone (at minimum light/dark theme + terminal font), semantic token mapping for both themes, contrast validation, persistence in local config (extend `config.md` or a dedicated appearance config), settings UI within the Appearance tab, migration/defaults.
- Define states, previews, accessibility (contrast AA, prefers-color-scheme default) and visual-baseline/tolerance updates.
- No runtime code changes in this task.

## Acceptance
- Design approved with explicit scope, token tables and implementation steps; T09 executable without further decisions.
