---
title: "M01 - T03 - Runtime PTY locale"
type: task
project: smart-terminal
created: 2026-10-22
id: "M01-T03"
milestone: "M01"
depends_on: "T02"
deliverables: "Runtime PTY locale"
---
<!-- gsynchro:v1 id=4c04f175-2678-433a-b209-a2393f6fc110 registered=2026-10-23T07:57:58.050Z -->

# M01 - T03 - Runtime PTY locale

## Obiettivo
Runtime PTY locale.

## Implementazione vincolata
Integrare node-pty per shell OS in servizio istanza e stream ad xterm.js.

## Criteri di accettazione
Input/output e resize PTY funzionano; exit gestito.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.
