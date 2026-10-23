---
title: "M02 - T03 - Assisted editor"
type: task
project: smart-terminal
created: 2026-10-22
id: "M02-T03"
milestone: "M02"
depends_on: "T02"
deliverables: "Assisted editor"
---
<!-- gsynchro:v1 id=2f3bb4b4-95d5-4e86-8f69-1176061ca8dd registered=2026-10-23T07:58:00.205Z -->

# M02 - T03 - Assisted editor

## Objective
Assisted editor.

## Constrained implementation
Pinned multiline input, send button, and Voice ready; explicit send to the active PTY.

## Acceptance criteria
Drafts for each tab; the editor does not intercept TUI in native mode.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce a database, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: Enter/Shift+Enter/IME, conditional send button, hint, `SessionsStore.sendActive` with 64 KiB UTF-8 limit and `\r`, draft cleared only on success, drafts per tab, `test:editor-smoke`.
- Verification: 52 Vitest tests, lint, typecheck, build, editor smoke with executed marker, draft cleared, shift-enter unhandled, isolated drafts.
- Minor deviation: `sendActive` is asynchronous because `writeTerminal` is asynchronous.
