---
title: "M04 - T02 - Git engine seriale"
type: task
project: smart-terminal
created: 2026-10-22
id: "M04-T02"
milestone: "M04"
depends_on: "T01"
deliverables: "Git engine seriale"
---
<!-- gsynchro:v1 id=fdeb2f63-26f3-41e2-81f0-6cad06eca6fa registered=2026-10-23T07:58:06.033Z -->

# M04 - T02 - Git engine seriale

## Obiettivo
Git engine seriale.

## Implementazione vincolata
Clone/init repo, commit scope sessions, fetch/rebase/push con mutex/backoff/offline.

## Criteri di accettazione
Nessun force push; recupero due commit concorrenti e offline.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.
