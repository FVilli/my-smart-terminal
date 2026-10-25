---
title: "M26 - T04 - Add the Markdown answer view and raw toggle"
type: task
project: smart-terminal
created: 2026-10-25
id: "M26-T04"
milestone: "M26"
depends_on: "M26-T03"
deliverables: "Safe Markdown answer component with raw view and selection-aware Use"
---
# M26 - T04 - Add the Markdown answer view and raw toggle

## Implementation
- New pure `markdown.logic.ts`: `renderMarkdown(text)` escaping HTML first and supporting fenced code blocks (language class only), inline code, headings, bold/italic, ordered/unordered lists, blockquotes, paragraphs and links restricted to `http(s)` with `rel="noreferrer noopener"`; unknown/unsafe markup stays literal text.
- New standalone `MarkdownView` component: Rendered/Raw toggle (buttons, aria-pressed), rendered container `data-testid="ai-answer-rendered"` and read-only raw textarea `data-testid="ai-answer"`; empty/error/loading states remain in the modal.
- `Use` selection: when the rendered view is active, capture `window.getSelection()` text only if the selection is inside the rendered container; raw view uses the textarea selection as today; fallback = whole answer. `Use` never submits.
- Unit tests for the renderer (escaping, code fence, links, unsafe URL, lists, no raw HTML); AI smoke updated to assert rendered answer text and raw toggle, and that Use inserts the answer (selection path via raw textarea).
## Acceptance
- Markdown renders safely, raw/rendered toggle works, Use selection/full answer works in both views, no new dependency; tests/smoke green.
