---
title: "M04 - T01 - Coordinator primary"
type: task
project: smart-terminal
created: 2026-10-22
id: "M04-T01"
milestone: "M04"
depends_on: ""
deliverables: "Coordinator primary"
---
<!-- gsynchro:v1 id=1f499c0e-15a9-47ca-8089-00cb4e1aa1bb registered=2026-10-23T07:58:05.254Z -->

# M04 - T01 - Coordinator primary

## Obiettivo
Coordinator primary.

## Implementazione vincolata
Lock/leader locale, IPC client-secondary, heartbeat e takeover su crash.

## Criteri di accettazione
Una sola primary per macchina e UI indicator corretto.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: elezione con lock/heartbeat/stale recovery, server Unix socket/named pipe con token e protocollo JSON whitelisted, client con token riletto, orchestratore primary/secondary con takeover, allocator remoto e switching, integrazione main, `isPrimary` + evento ruolo, footer dinamico.
- Verifica: 203 test (multi-processo, 8 elezioni concorrenti, kill -9 con takeover, token/metodi/oversize, permessi), `test:coordinator`, tutti gli smoke; IPC smoke con `isPrimary:true` e primary indicator.
- Deviazioni: fallback all'allocatore su file se il primary è irraggiungibile (lock condiviso, nessun blocco); rilascio sincrono del lock su `process.exit` per gli smoke; limite path socket ~108 char (M06).
