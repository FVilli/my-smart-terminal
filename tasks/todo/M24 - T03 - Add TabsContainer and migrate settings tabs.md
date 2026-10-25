---
title: "M24 - T03 - Add TabsContainer and migrate settings tabs"
type: task
project: smart-terminal
created: 2026-10-25
id: "M24-T03"
milestone: "M24"
depends_on: "M24-T02"
deliverables: "Reusable accessible TabsContainer component and settings tabs migrated to it"
---

# M24 - T03 - Add TabsContainer and migrate settings tabs

## Implementation
- New standalone `TabsContainer` component in a shared feature folder: inputs `tabs` (`{id,label,disabled?}[]`), `activeId`; output `selected`; content projection per panel via `ng-template`/`@switch` pattern or `[panel]` directive; `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls`, roving tabindex, ArrowLeft/Right/Home/End, Enter/Space.
- Visual style matches the sidebar Clipboard/History tabs (border-bottom, accent active indicator) using M20 tokens; no palette literals.
- Migrate the five settings tabs (Repository, AI, STT, Appearance, AI Actions) to `TabsContainer`; keep the same `data-testid` values `settings-tab-*` on the tab buttons and preserve the dialog body switching/scroll.
- Unit tests for keyboard/ARIA selection (component test or pure tab-key reducer), plus settings smoke unchanged ids.
- Optionally reuse `TabsContainer` in the sidebar later; not required here.

## Acceptance
- One tab implementation for settings, accessible keyboard behaviour, no visual regression, smokes/layout green.
