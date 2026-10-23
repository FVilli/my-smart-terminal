---
title: "M01 - T01 - Scaffold monorepo"
type: task
project: smart-terminal
created: 2026-10-22
id: "M01-T01"
milestone: "M01"
depends_on: ""
deliverables: "Scaffold monorepo"
---
<!-- gsynchro:v1 id=092350b9-daa9-40d0-a249-14981267d8dc registered=2026-10-23T07:57:56.378Z -->

# M01 - T01 - Scaffold monorepo

## Obiettivo
Scaffold monorepo.

## Implementazione vincolata
Preparare workspace Angular standalone, Electron main/preload e TypeScript shared; script dev/build/lint.

## Criteri di accettazione
Avvio finestra Electron con Angular; typecheck e lint senza errori.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: npm workspaces, Angular 22.2.3 (application builder), Electron 45, bundle esbuild per main/preload, contratti IPC condivisi, protocollo custom `smart-terminal://` per il renderer in produzione, smoke mode.
- Verifica: `npm run lint`, `npx tsc -p tsconfig.json --noEmit`, `npm run build`, `SMART_TERMINAL_SMOKE=1 npx electron apps/desktop` con esito `hasApi: true` e UI Angular renderizzata.
- Deviazioni: tooling di build (esbuild, concurrently, wait-on, cross-env) e dettagli runtime registrati in `docs/10 - Config locale, coordinatore e sicurezza runtime.md`. Nessun database o servizio remoto aggiunto.
