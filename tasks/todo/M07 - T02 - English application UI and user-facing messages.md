---
title: "M07 - T02 - English application UI and user-facing messages"
type: task
project: smart-terminal
created: 2026-10-23
id: "M07-T02"
milestone: "M07"
depends_on: ""
deliverables: "English application UI and user-facing messages"
---

# M07 - T02 - English application UI and user-facing messages

## Objective
Translate all user-facing strings in the desktop application to English.

## Constrained implementation
Cover Angular templates/components, placeholders, buttons, aria labels, notices, onboarding wizard, SSH menu, editor, sidebar, footer, errors, status labels, AI/STT notices and smoke-test expectations. Keep behavior unchanged. Use consistent terms: session, tab, draft, history, clipboard, primary instance, repository, sync.

## Acceptance criteria
The application contains no Italian user-facing text; lint, typecheck, build and all smoke tests pass with updated English assertions; onboarding and error states are readable in English.

## References
docs/08 - UX e interazioni.md; docs/12 - Manuale utente.md; apps/renderer.

## Do not
Do not translate code identifiers or change functionality in this task.
