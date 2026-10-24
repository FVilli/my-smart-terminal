---
title: "M20 - Tailwind styling consolidation"
type: milestone
project: smart-terminal
created: 2026-10-24
id: "M20"
goal: "Consolidate Angular renderer styling on Tailwind CSS 4 and semantic design tokens while preserving the approved visual baseline and all terminal/input behavior."
depends_on: "M19"
---
<!-- gsynchro:v1 id=ebe652af-f2fc-44fb-ab64-d7daa89a3422 registered=2026-10-24T17:27:32.597Z -->

# M20 - Tailwind styling consolidation

## Scope
- Audit renderer templates and CSS; introduce Tailwind CSS 4 in the existing Angular build.
- Centralize the documented visual palette and spacing into semantic tokens.
- Migrate app shell, tabs, sidebar, footer, settings and assisted input incrementally.
- Remove superseded selectors only after layout/behavior verification.

## Fixed decisions
- Keep Electron, Angular standalone, strict TypeScript and xterm.js; do not introduce a component framework or runtime UI dependency.
- Tailwind handles layout, spacing, typography, borders and states. CSS variables define semantic design tokens. Component-scoped CSS is permitted for genuinely complex rules; xterm-specific styling stays separate.
- Preserve documented 75/25 horizontal split, mock geometry, zoom, keyboard/focus behavior, accessibility and platform support.
- Refactor only: no new product features, no IPC changes, no provider, Git or PTY behavior changes.

## Task sequence
T01 audit and baseline → T02 Tailwind integration → T03 tokens/shared primitives → T04 shell/tabs/sidebar/footer → T05 assisted input/settings → T06 cleanup and regression verification.

## Acceptance
- Angular renderer builds with pinned Tailwind dependencies and no runtime CDN.
- Semantic tokens are used consistently; no new arbitrary hard-coded colors, inline style strings or broad `!important` workarounds.
- Existing visual baseline and input/terminal interaction contracts remain satisfied at 1440×900 and 1024×700, plus zoom 50%–200%.
- Unit, typecheck, lint, renderer smoke and available Linux packaging checks pass; exceptions documented with before/after evidence.
- Documentation updated to reflect the implemented styling conventions, and no duplicate styling systems remain authoritative.
