---
title: "M20 - T05 - Migrate assisted input and settings"
type: task
project: smart-terminal
created: 2026-10-24
id: "M20-T05"
milestone: "M20"
depends_on: "M20-T04"
deliverables: "Tailwind styling for composer, STT controls and settings screens"
---
<!-- gsynchro:v1 id=a8652d00-71d4-4755-90e0-de653177728c registered=2026-10-24T17:27:36.459Z -->

# M20 - T05 - Migrate assisted input and settings

## Objective
Normalize remaining visible form surfaces without modifying interaction contracts.

## Implementation
- Migrate assisted editor, AI action, mic/recording indicators, STT diagnostics, settings tabs/forms and onboarding surfaces to shared tokens/controls.
- Preserve per-session draft, keyboard passthrough, focus transitions, terminal shortcuts, recording/error/loading feedback and accessible names.
- Reconcile any component CSS that must remain for resizing, animation or platform/browser differences and document exceptions.
- Verify no DOM move or refactor causes unwanted PTY input focus or microphone lifecycle transitions.

## Acceptance
Existing assisted input and STT interaction matrix tests pass; focus, keyboard and screen-reader labels remain correct; settings and composer screenshot comparison passes.
