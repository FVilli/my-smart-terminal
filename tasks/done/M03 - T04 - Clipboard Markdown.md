---
title: "M03 - T04 - Markdown clipboard"
type: task
project: smart-terminal
created: 2026-10-22
id: "M03-T04"
milestone: "M03"
depends_on: "T01"
deliverables: "Markdown clipboard"
---
<!-- gsynchro:v1 id=ccd348b8-2d57-4563-aaa9-b86b80cf1f44 registered=2026-10-23T07:58:03.865Z -->

# M03 - T04 - Markdown clipboard

## Objective
Markdown clipboard.

## Constrained implementation
Monitor text clipboard, deduplicate, support opt-out and secret filtering, associate with the active session.

## Acceptance criteria
Update clipboard.md without duplicates or sensitive samples.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce a database, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: testable `ClipboardRecorder` (opt-in, pause, 800 ms polling, 32 KiB limit, hash, file+memory deduplication, secret filter), main service with a single instance/timer, active session association on tab/focus, sidebar controls (enable, pause, clear, status), smoke test with real clipboard.
- Verification: clipboard smoke with disabledByDefault, enabledViaUi, paused/resumedViaUi, eventRecorded, hashMatches, sensitiveNotRecorded, pollingContinuesAfterSensitive.
- Note: "Clear deduplication" clears memory only; hashes already on file remain deduplicated.
