---
title: "M27 - T02 - Add the clipboard placeholder"
type: task
project: smart-terminal
created: 2026-10-25
id: "M27-T02"
milestone: "M27"
depends_on: "M27-T01"
deliverables: "{{clipboard}} placeholder resolved in main with cap and tests"
---
# M27 - T02 - Add the clipboard placeholder

## Implementation
- Contracts: add `clipboard` to `AI_PLACEHOLDERS`; docs/UI placeholder list (ai-actions-settings) updated.
- Main: inject a clipboard reader into AiService; `compose` resolves the current clipboard text, strips NUL, truncates to a safe cap (e.g. 16 KiB, never exceeding the rendered limit) and passes it to `composeAction`; no persistence/logging.
- Test mode stays deterministic (clipboard text is still read but the action path is unchanged); the secret gate still runs on the rendered prompts.
## Acceptance
- `{{clipboard}}` renders in compose, is truncated safely, appears in the settings placeholder help, has unit tests, AI smoke unaffected.
