---
title: "M03 - T02 - Allocazione ID atomica"
type: task
project: smart-terminal
created: 2026-10-22
id: "M03-T02"
milestone: "M03"
depends_on: "T01"
deliverables: "Allocazione ID atomica"
---
<!-- gsynchro:v1 id=1799c10c-9db0-4741-b778-365e83e7ec33 registered=2026-10-23T07:58:02.270Z -->

# M03 - T02 - Allocazione ID atomica

## Obiettivo
Allocazione ID atomica.

## Implementazione vincolata
Richiedere progressivo per macchina via lock, non riutilizzare ID; supportare finestre simultanee.

## Criteri di accettazione
Due richieste concorrenti ricevono S diversi; riavvio continua.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: `FileSessionIdAllocator` con lock directory atomico, owner/nonce, recovery stale, counter `sessions/<machine>/counter.md` prenotato prima dell'uso, bootstrap da directory, collisioni, lock rilascio garantito; `DataRuntime` e integrazione `TerminalHost` (create async, `ended_at`, ID persistenti).
- Verifica: 101 test Vitest; concorrenza 10 in-process e 3 processi × 6 allocazioni senza duplicati; restart/counter corrotto/lock stale; smoke ipc/pty/tabs/layout/editor/sidebar verdi.
- Nota: su fallimento spawn la directory resta con `ended_at` e l'ID consumato non viene riusato; documentato.
