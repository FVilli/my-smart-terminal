---
title: "M03 - T05 - Search index in memoria"
type: task
project: smart-terminal
created: 2026-10-22
id: "M03-T05"
milestone: "M03"
depends_on: "T03,T04"
deliverables: "Search index in memoria"
---
<!-- gsynchro:v1 id=ed434da9-f98c-43f1-bf01-5a623d45433b registered=2026-10-23T07:58:04.634Z -->

# M03 - T05 - Search index in memoria

## Obiettivo
Search index in memoria.

## Implementazione vincolata
Parser e indice volatile full-text su Markdown, filtro macchina/sessione/data.

## Criteri di accettazione
Ricerca globale funziona senza DB e dopo restart ricostruisce indice.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.


## Esito
- 2026-10-23: completato.
- Implementato: `MarkdownSearchIndex` volatile con rebuild/refresh incrementale/upsert, scansione solo `sessions/` senza symlink e con limite 2 MiB, filtri macchina/sessione/data/kind, cap 100; `SearchService` main con rebuild all'avvio e aggiornamento dopo history/clipboard/fine sessione; canale `search:query` e API preload.
- Verifica: search smoke con found, entryShape, filtersWork, sensitiveNotIndexed, invalidRejected, rebuiltIndexFindsEvent; test di restart, symlink e oversize.
