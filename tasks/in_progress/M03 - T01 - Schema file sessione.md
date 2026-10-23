---
title: "M03 - T01 - Schema file sessione"
type: task
project: smart-terminal
created: 2026-10-22
id: "M03-T01"
milestone: "M03"
depends_on: ""
deliverables: "Schema file sessione"
---
<!-- gsynchro:v1 id=b81314ab-2156-4a6c-a324-9f0c7db374c0 registered=2026-10-23T07:58:01.573Z -->

# M03 - T01 - Schema file sessione

## Obiettivo
Schema file sessione.

## Implementazione vincolata
Implementare serializer Markdown/frontmatter e path YYYY-MM-DD_HH.mm_Sn_destination.

## Criteri di accettazione
Roundtrip parse/write test e file leggibili. 

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: frontmatter flat con campi extra conservati/rifiutabili, path builder/parser con normalizzazione e anti-traversal, schema `session.md`/`history.md`/`clipboard.md`, eventi con fence dinamica e dedupe, scritture atomiche.
- Verifica: test roundtrip con unicode/newline/backtick, campi invalidi, path traversal, dedupe; inclusi in `npm run test` (101 test totali).
- Correzione in review: aggiunto `created_at` a `session.md` come richiesto dal frontmatter comune di `docs/03`.
