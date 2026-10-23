---
title: "M03 - T01 - Session file schema"
type: task
project: smart-terminal
created: 2026-10-22
id: "M03-T01"
milestone: "M03"
depends_on: ""
deliverables: "Session file schema"
---
<!-- gsynchro:v1 id=b81314ab-2156-4a6c-a324-9f0c7db374c0 registered=2026-10-23T07:58:01.573Z -->

# M03 - T01 - Session file schema

## Objective
Session file schema.

## Constrained implementation
Implement Markdown/frontmatter serialization and path YYYY-MM-DD_HH.mm_Sn_destination.

## Acceptance criteria
Roundtrip parse/write test and readable files.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce a database, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: flat frontmatter with preserved/rejectable extra fields, path builder/parser with normalization and anti-traversal, `session.md`/`history.md`/`clipboard.md` schemas, events with dynamic fences and deduplication, atomic writes.
- Verification: roundtrip tests with unicode/newline/backtick, invalid fields, path traversal, and deduplication; included in `npm run test` (101 total tests).
- Review correction: added `created_at` to `session.md` as required by the common frontmatter in `docs/03`.
