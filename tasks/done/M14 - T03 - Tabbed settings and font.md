---
title: "M14 - T03 - Tabbed settings and terminal font"
type: task
project: smart-terminal
created: 2026-10-23
id: "M14-T03"
milestone: "M14"
depends_on: "M14-T01"
deliverables: "First-run wizard retained; edit mode tabs Repository/AI/STT/Appearance; persisted terminal monospace font"
---

# M14 - T03 - Tabbed settings and terminal font

## Objective
Keep the wizard for first run, but make later settings navigable and add typography control.

## Constrained implementation
In the existing in-app dialog, keep first-run steps 1-3. In edit mode replace step navigation with tabs: Repository, AI, STT, Appearance. Preserve validation, Save/Cancel, dirty-confirm, Escape, restart notice, IPC and existing test IDs. Add Appearance with terminal monospace font presets (current stack default), persist a schema-compatible font field, apply to xterm and assisted input without restart, with fallback when a font is missing. Update tests/smokes.

## Acceptance
First run unchanged; settings tabs switch sections; dirty/save/restart behavior preserved; font selection persists, applies live, and falls back safely; no arbitrary CSS injection.
