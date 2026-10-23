---
title: "M04 - T03 - Debounce e polling"
type: task
project: smart-terminal
created: 2026-10-22
id: "M04-T03"
milestone: "M04"
depends_on: "T02"
deliverables: "Debounce e polling"
---
<!-- gsynchro:v1 id=8dc20d5f-32f8-46f5-9750-6aef12829bce registered=2026-10-23T07:58:06.836Z -->

# M04 - T03 - Debounce e polling

## Obiettivo
Debounce e polling.

## Implementazione vincolata
Eventi dirty, 10s debounce, 60s max, fetch 15s; gestione stop/avvio.

## Criteri di accettazione
Test fake timers sui trigger, nessun commit a vuoto.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.
