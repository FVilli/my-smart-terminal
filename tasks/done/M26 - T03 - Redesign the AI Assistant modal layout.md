---
title: "M26 - T03 - Redesign the AI Assistant modal layout"
type: task
project: smart-terminal
created: 2026-10-25
id: "M26-T03"
milestone: "M26"
depends_on: "M26-T02"
deliverables: "Large two-column AI Assistant modal with a compact header"
---
# M26 - T03 - Redesign the AI Assistant modal layout

## Implementation
- Dialog size 90vw × 90vh (inside the backdrop padding), rounded/border/tokens unchanged.
- Compact header: one row with title "AI assistant", session context and provider/model; move the unconfigured warning and Detect again into the same row or a slim second line; remove the oversized header padding/stack.
- Body `grid grid-cols-2` (50%/50%) with two scrollable panes:
  - left: action select, System prompt textarea, User prompt textarea, Send + counters;
  - right: Answer area with view toggle, status/error, empty/loading hints.
- Footer spans the dialog (Cancel/Use/Close); preserve focus trap, Escape, focus return, Ctrl/Cmd+Enter, disabled logic, all test ids (`ai-action-select`, `ai-system-prompt`, `ai-user-prompt`, `ai-send`, `ai-answer`, `ai-use`, `ai-cancel`, `ai-close`) and session/provider context.
- No palette literals/inline styles; responsive at 1024×700 and zoom.
## Acceptance
- 90% size, compact header, 50/50 panes, no clipping, all existing behaviour/test ids preserved; layout/tests green.
