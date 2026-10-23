---
title: "M02 - T03 - Editor assistito"
type: task
project: smart-terminal
created: 2026-10-22
id: "M02-T03"
milestone: "M02"
depends_on: "T02"
deliverables: "Editor assistito"
---
<!-- gsynchro:v1 id=2f3bb4b4-95d5-4e86-8f69-1176061ca8dd registered=2026-10-23T07:58:00.205Z -->

# M02 - T03 - Editor assistito

## Obiettivo
Editor assistito.

## Implementazione vincolata
Input multilinea pinned, pulsante invio e Voice ready; invio esplicito al PTY attivo.

## Criteri di accettazione
Bozze per tab, editor non intercetta TUI in modalità native.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: Invio/Shift+Invio/IME, pulsante invio condizionato, hint, `SessionsStore.sendActive` con limite 64 KiB UTF-8 e `\r`, bozza svuotata solo su successo, bozze per tab, smoke `test:editor-smoke`.
- Verifica: 52 test Vitest, lint, typecheck, build, smoke editor con marker eseguito, draft cleared, shift-enter non gestito, bozze isolate.
- Deviazione minore: `sendActive` asincrona perché `writeTerminal` è asincrona.
