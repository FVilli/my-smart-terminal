---
title: "M27 - T01 - Fill the assistant layout and remember the last action"
type: task
project: smart-terminal
created: 2026-10-25
id: "M27-T01"
milestone: "M27"
depends_on: "M26"
deliverables: "Full-height assistant panes, one-row answer toolbar and persisted last action"
---
# M27 - T01 - Fill the assistant layout and remember the last action

## Implementation
- Left pane: fixed action select/notice and Send row; System and User labels each in a `min-h-0 flex-1 flex-col` cell of a two-row grid so both textareas take 50% of the pane height (`resize-none`, internal scroll).
- Right pane: heading removed into MarkdownView; MarkdownView toolbar renders the optional `label` ("Answer") left and Rendered/Raw right; rendered pane/textarea fills the remaining height.
- Persist the last action in a tiny `ai-last-action.ts` helper (localStorage key, try/catch, validates against known ids) and preselect it on open; kept per-session prompt keeps priority; persist on select.
## Acceptance
- Both prompts and the answer fill their panes at 1440×900/1024×700; toolbar on one row; reopening selects the last action; tests green.
