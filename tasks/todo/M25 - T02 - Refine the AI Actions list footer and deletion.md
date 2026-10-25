---
title: "M25 - T02 - Refine the AI Actions list footer and deletion"
type: task
project: smart-terminal
created: 2026-10-25
id: "M25-T02"
milestone: "M25"
depends_on: "M25-T01"
deliverables: "Footer with line/counter only and confirmed deletion of custom actions"
---
# M25 - T02 - Refine the AI Actions list footer and deletion

## Implementation
- Footer: keep `border-t border-line`, remove the `bg-card` background, keep only `+`; remove the bulk Reset control and its confirmation block; add a small muted counter `BUILT-IN:<n> CUSTOM:<n>`.
- Custom action Delete requires an inline confirmation (`role=alertdialog`, Confirm/Cancel); built-in Delete stays absent; per-action Reset for built-ins remains.
- Update test ids (`ai-settings-reset` removed; `ai-settings-delete-confirm`/`cancel` added; counter `ai-settings-counts`); adjust unit/smoke expectations.
## Acceptance
- Footer visual per spec, no bulk reset, confirmed custom deletion, tests/smoke green.
