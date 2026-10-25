---
title: "M23 - T01 - Contracts and AI template store"
type: task
project: smart-terminal
created: 2026-10-25
id: "M23-T01"
milestone: "M23"
depends_on: "M22"
deliverables: "Typed action/template contracts, validated local store with defaults, reset and corrupt-config fallback"
---

# M23 - T01 - Contracts and AI template store

## Objective
Define the action/template model once and persist it safely in local configuration.

## Implementation
- Contracts: `AiActionDefinition` (`id`, `title`, `description`, `systemTemplate`, `userTemplate`, `builtIn`), `AiActionsState` (`actions`, `placeholders`), `AiActionsSaveRequest` (upsert by id), `AiActionsResetRequest` (built-in id), `AiActionResult` unchanged plus new compose/action request shapes (`actionId`, `composerText`, `consoleText?`, `environment?`; action sends `system`/`user`).
- Constant placeholder list and length limits (templates ≤8 KiB each, title ≤60, description ≤200, max 20 actions, custom id `custom-<slug>` validated).
- Defaults for the five built-ins in `packages/ai` with `{{os}}`, `{{shell}}`, `{{terminalInfo}}`, `{{console}}`, `{{composer}}`, `{{intent}}` used purposefully.
- `AiActionsStore` in main: load/save/reset/delete against `userData/config/ai-actions.json` with a schema version, atomic writes, validation, corrupt-config fallback to defaults + sanitized warning; never throws to IPC.
- Tests: defaults, round-trip, invalid types/placeholders/limits, reset, corrupt file fallback, custom add/delete.

## Acceptance
- Contracts compile, store performs atomic validated reads/writes; no change yet to modal behaviour beyond types.
