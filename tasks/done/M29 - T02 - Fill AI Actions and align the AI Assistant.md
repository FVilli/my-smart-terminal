---
title: "M29 - T02 - Fill AI Actions and align the AI Assistant"
type: task
project: smart-terminal
created: 2026-10-25
id: "M29-T02"
milestone: "M29"
depends_on: "M29-T01"
deliverables: "Height-filling AI Actions editor/list and fully used assistant answer pane"
---
# M29 - T02 - Fill AI Actions and align the AI Assistant

## Implementation
- AI Actions settings: two full-height panes; left list scrolls with a pinned counter row; right editor is a flex column with title/description, a two-row template grid that grows, and icon action row; labels/fields use form primitives with consistent gaps.
- Assistant: AI action label/select use `form-field`/`form-label`; prompts use the same; `MarkdownView` rendered pane and raw textarea use `flex-1 min-h-0` so the Answer fills the height between toolbar and bottom; advisory/status stay compact.
## Acceptance
- Both AI surfaces use the height; spacing uniform; no clipping at 1024×700/zoom; tests/smoke green.
