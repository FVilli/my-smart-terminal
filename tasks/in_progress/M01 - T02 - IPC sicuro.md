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

## Esito
- 2026-10-23: completato.
- Implementato: `ipc.ts` (validazione pura, limite 64 KiB, sender main-frame/origin, errori sanificati), binding `ipc-electron.ts` registrato una sola volta con set di finestre tracciate, canali `app:ping` e `app:runtime-info`, preload minimale, seam `__testInvoke` solo in smoke, `smoke.ts`.
- Verifica: 12 test Vitest, lint, typecheck, build e `npm run test:ipc-smoke` (exit 0) con payload invalido e canale sconosciuto rifiutati, `require`/`process` undefined nel renderer, sole chiavi `ping,runtimeInfo` esposte.
- Deviazione/correzione in review: handler registrati una volta per processo e sender set dinamico, per evitare errori con finestre multiple.
