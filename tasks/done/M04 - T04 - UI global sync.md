---
title: "M04 - T04 - UI global sync"
type: task
project: smart-terminal
created: 2026-10-22
id: "M04-T04"
milestone: "M04"
depends_on: "T03"
deliverables: "UI global sync"
---
<!-- gsynchro:v1 id=8cfd4d15-2a4f-411f-ae1c-bd2c02e9aef2 registered=2026-10-23T07:58:07.421Z -->

# M04 - T04 - UI global sync

## Obiettivo
UI global sync.

## Implementazione vincolata
Collegare sidebar a indice comune aggiornato su pull; badge synced/offline/error.

## Criteri di accettazione
Prompt da altra macchina appare dopo pull; errori non bloccano PTY.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: RPC `search.facets`, `clipboard.*`, `session.end`; clipboard posseduta dal primary con inoltro dei secondary; `SearchStore` (debounce 200 ms, filtri, refresh su evento/focus/15 s), sidebar History/Clipboard reale con copia/inserimento, footer dinamico con "Repo non configurato", evento `search:refreshed`, polling stato sync 5 s.
- Verifica: 256 test (cross-machine idle, clipboard primary/secondary, store), smoke `sync-ui` con prompt locale e remoto, filtri, copy/insert, clipboard sensibile esclusa, footer, nessun overflow; tutti gli altri smoke verdi.
- Follow-up in review: il fetch periodico ora integra i commit remoti (`integrateRemote`) così una macchina inattiva vede i prompt dell'altra senza scrivere; test idle-machine dedicato.
- Deviazioni: refresh periodico 15 s su entrambe le tab; senza primary lo stato sync è `offline`; copy/insert non inviano automaticamente.
