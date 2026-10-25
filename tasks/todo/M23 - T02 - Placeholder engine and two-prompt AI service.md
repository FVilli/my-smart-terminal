---
title: "M23 - T02 - Placeholder engine and two-prompt AI service"
type: task
project: smart-terminal
created: 2026-10-25
id: "M23-T02"
milestone: "M23"
depends_on: "M23-T01"
deliverables: "Deterministic placeholder rendering and ai:compose/ai:action with editable System and User prompts"
---

# M23 - T02 - Placeholder engine and two-prompt AI service

## Objective
Render templates with session/composer/console context and send the two reviewed prompts to the provider.

## Implementation
- Pure renderer in `packages/ai`: replaces the documented placeholders, leaves unknown ones literal, caps rendered prompts (32 KiB) and reports used placeholders; unit tests for each placeholder, unknown names, missing context (`unknown`), no recursive substitution, and injection text staying inside the values.
- `ai:compose` → `{ system, user }` from the stored action templates + request context; `ai:action` → provider call with exactly the submitted `system`/`user` (no hidden concatenation), sanitized results, 15 s timeout, secret gate on both prompts.
- IPC validators updated (actionId exists, prompt sizes, consoleText ≤16 KiB, environment enums, exact keys); preload/API updated; tests for validation and rendering.
- Terminal info string format: `<label> · <kind> · <os> · <shell>` or `unknown` fields; documented in docs/36.

## Acceptance
- Compose returns both prompts deterministically; action sends exactly what the user reviewed; secret/limits/timeouts preserved.
