---
title: "M21 - T01 - Define repository-wide coding rules"
type: task
project: smart-terminal
created: 2026-10-24
id: "M21-T01"
milestone: "M21"
depends_on: "M20"
deliverables: "docs/26 - Code quality rules.md, examples and worker review checklist"
---
<!-- gsynchro:v1 id=1593cd14-f97f-4c5d-ac47-34233b127a5b registered=2026-10-24T22:31:29.284Z -->

# M21 - T01 - Define repository-wide coding rules

## Objective
Create the first mandatory and versioned coding rulebook before changing code.

## Implementation
- Inventory code languages and boundaries in `apps/` and `packages/`; classify rules as mandatory/preferred/context-dependent.
- Specify strict TypeScript naming, imports/exports, type narrowing, null/error handling, async cancellation, ownership, pure helpers, cohesion and dependencies.
- Prefer explicit domain names, early returns and single-purpose functions; ban `any` without justified exception, unguarded casts, hidden side effects, unused code, redundant wrappers and premature generalization.
- Keep security-sensitive Electron IPC/secret code explicit; preserve validation and failure semantics.
- Codify documentation of exceptions, small PRs and independent worker review; include good/bad local examples.
- Add mandatory worker instruction: read rules before tasks; exceptions must be written and reviewed, not silently introduced.

## Acceptance
Rulebook exists with YAML frontmatter, precise MUST/SHOULD/MAY language, examples and a review checklist; no runtime files changed.
