---
title: "M05 - T03 - Adapter correzione AI"
type: task
project: smart-terminal
created: 2026-10-22
id: "M05-T03"
milestone: "M05"
depends_on: "T02"
deliverables: "Adapter correzione AI"
---
<!-- gsynchro:v1 id=93259279-5635-4f29-a0de-556c83c478db registered=2026-10-23T07:58:09.673Z -->

# M05 - T03 - Adapter correzione AI

## Obiettivo
Adapter correzione AI.

## Implementazione vincolata
Provider Anthropic, OpenAI, locale; prompt refusi-only e review prima dell’invio.

## Criteri di accettazione
Nessuna correzione dei comandi shell; timeout fallback; test path/codice preservati.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.
