---
title: "M21 - T05 - Refactor Angular renderer by feature"
type: task
project: smart-terminal
created: 2026-10-24
id: "M21-T05"
milestone: "M21"
depends_on: "M21-T04"
deliverables: "Readable renderer components/services/templates with narrow diffs and focused tests"
---
<!-- gsynchro:v1 id=444ca35b-29e6-49dd-89e9-ac6f3c6fb22a registered=2026-10-24T22:31:29.288Z -->

# M21 - T05 - Refactor Angular renderer by feature

## Objective
Apply approved T01–T04 standards to renderer without changing visible behavior.

## Implementation
- Process by feature: app shell/sessions, terminal integration, sidebar/history, assisted composer, settings/onboarding.
- Separate presentation from orchestration where currently mixed; shorten long methods, remove duplication and dead paths without introducing generic frameworks.
- Simplify template state/conditions and lifecycle cleanup; use supported Angular idioms only.
- Preserve Tailwind conventions from M20, mock visuals, accessibility, input focus, shortcuts, terminal pass-through and session drafts.
- Add rationale/invariant comments especially around keyboard handling, xterm hooks and asynchronous resource cleanup.
- Use characterization tests before changing ambiguous or fragile paths; keep changes reviewable by feature.

## Acceptance
Same UI/interaction contracts, unchanged IPC payloads, focused tests pass, no material DOM/layout regressions, no new dependencies.
