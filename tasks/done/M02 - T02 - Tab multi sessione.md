---
title: "M02 - T02 - Tab multi sessione"
type: task
project: smart-terminal
created: 2026-10-22
id: "M02-T02"
milestone: "M02"
depends_on: "T01"
deliverables: "Tab multi sessione"
---
<!-- gsynchro:v1 id=4091757f-4ba7-4ee8-a766-f1ec5da7f7c4 registered=2026-10-23T07:57:59.382Z -->

# M02 - T02 - Tab multi sessione

## Obiettivo
Tab multi sessione.

## Implementazione vincolata
Creare/attivare/chiudere PTY per tab, bozze separate, background running.

## Criteri di accettazione
Due sessioni indipendenti; switching non uccide processi.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.


## Esito
- 2026-10-23: completato.
- Implementato: `SessionsStore` (sessioni, activeId, bozze, errori, buffer output), pannelli xterm persistenti nascosti via CSS, creazione locale da `+`, switch/close con conferma inline, empty/error state, etichette S<n> per finestra.
- Verifica: `npm run test:tabs-smoke` con `twoTabs`, `panelsMounted`, `switchKeepsSessions`, `closedOne` tutti true; 46 test Vitest; build/lint/typecheck verdi.
- Nota: etichette S<n> sono provvisorie per finestra; M03 le sostituirà con ID atomici persistenti.
