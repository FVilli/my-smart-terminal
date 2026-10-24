---
title: "M20 - T01 - Audit renderer styling and capture baseline"
type: task
project: smart-terminal
created: 2026-10-24
id: "M20-T01"
milestone: "M20"
depends_on: "M19"
deliverables: "Renderer styling inventory and reproducible pre-refactor visual/test baseline"
---
<!-- gsynchro:v1 id=b369e592-0268-4c52-8c81-517eafee6b69 registered=2026-10-24T17:27:33.274Z -->

# M20 - T01 - Audit renderer styling and capture baseline

## Objective
Inventory existing renderer styling without changing production behavior.

## Implementation
- Inspect `apps/renderer/src` HTML/templates, global/component styles, Angular configuration and package-lock; map all existing styling entry points.
- Catalog color/spacing/font constants, inline styles, `!important`, duplicated selectors and existing UI primitives; separate required xterm rules.
- Identify affected components and style ownership; capture baseline at 1440×900 and 1024×700, including sidebar split, tabs, composer, settings and footer.
- Run existing typecheck/lint/tests and capture failures before migration. Record baseline in a short `docs/` Markdown note with frontmatter.

## Acceptance
Inventory contains file paths and migration order; images/measurements and pre-existing failures are recorded; no user-facing behavior changes.
