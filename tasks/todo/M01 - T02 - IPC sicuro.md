---
title: "M01 - T02 - IPC sicuro"
type: task
project: smart-terminal
created: 2026-10-22
id: "M01-T02"
milestone: "M01"
depends_on: "T01"
deliverables: "IPC sicuro"
---
<!-- gsynchro:v1 id=586818af-b865-43bf-b920-30494b51c0e3 registered=2026-10-23T07:57:57.171Z -->

# M01 - T02 - IPC sicuro

## Obiettivo
IPC sicuro.

## Implementazione vincolata
Preload tipizzato con canali approvati e contextIsolation true, nodeIntegration false; validare payload.

## Criteri di accettazione
Renderer senza Node; test IPC di risposta e rifiuto payload invalidi.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.
