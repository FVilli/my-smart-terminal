---
title: "M03 - T05 - In-memory search index"
type: task
project: smart-terminal
created: 2026-10-22
id: "M03-T05"
milestone: "M03"
depends_on: "T03,T04"
deliverables: "In-memory search index"
---
<!-- gsynchro:v1 id=ed434da9-f98c-43f1-bf01-5a623d45433b registered=2026-10-23T07:58:04.634Z -->

# M03 - T05 - In-memory search index

## Objective
In-memory search index.

## Constrained implementation
Parser and volatile full-text index for Markdown, with machine/session/date filters.

## Acceptance criteria
Global search works without a database and rebuilds the index after restart.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce a database, additional remote services, or architectural choices not specified.


## Outcome
- 2026-10-23: completed.
- Implemented: volatile `MarkdownSearchIndex` with rebuild/incremental refresh/upsert, scanning only `sessions/` without symlinks and with a 2 MiB limit, machine/session/date/kind filters, cap 100; main `SearchService` with rebuild at startup and updates after history/clipboard/session end; `search:query` channel and preload API.
- Verification: search smoke with found, entryShape, filtersWork, sensitiveNotIndexed, invalidRejected, rebuiltIndexFindsEvent; restart, symlink, and oversize tests.
