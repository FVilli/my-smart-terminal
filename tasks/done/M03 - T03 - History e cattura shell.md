---
title: "M03 - T03 - History and shell capture"
type: task
project: smart-terminal
created: 2026-10-22
id: "M03-T03"
milestone: "M03"
depends_on: "T01"
deliverables: "History and shell capture"
---
<!-- gsynchro:v1 id=b214312f-aed5-4799-8c99-a530cd628df7 registered=2026-10-23T07:58:03.113Z -->

# M03 - T03 - History and shell capture

## Objective
History and shell capture.

## Constrained implementation
Capture editor and shell submissions with a reliable mechanism; idempotent events.

## Acceptance criteria
Update history.md; do not save passwords; no raw keystroke logging.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce a database, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: shared secret filter, `history:record` with fixed `assisted` source, UUID/timestamp/cwd, idempotency and atomicity, renderer call only after successful submission, extended editor smoke test.
- Verification: filter/append/limit tests; editor smoke with historyAssistedRecorded, historyEnterRecorded, historySensitiveNotRecorded, historyCwdPresent.
- **Explicit deviation**: the native shell is not recorded in M03. No injection into `.bashrc`/`.zshrc`, no keystrokes, no TUI interception; only explicit submissions from the assisted editor (`docs/03`).
