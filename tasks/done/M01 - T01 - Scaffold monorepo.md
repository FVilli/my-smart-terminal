---
title: "M01 - T01 - Monorepo scaffold"
type: task
project: smart-terminal
created: 2026-10-22
id: "M01-T01"
milestone: "M01"
depends_on: ""
deliverables: "Monorepo scaffold"
---
<!-- gsynchro:v1 id=092350b9-daa9-40d0-a249-14981267d8dc registered=2026-10-23T07:57:56.378Z -->

# M01 - T01 - Monorepo scaffold

## Objective
Monorepo scaffold.

## Constrained implementation
Prepare a standalone Angular workspace, Electron main/preload, and shared TypeScript; dev/build/lint scripts.

## Acceptance criteria
Launch an Electron window with Angular; typecheck and lint without errors.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce a database, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: npm workspaces, Angular 22.2.3 (application builder), Electron 45, esbuild bundle for main/preload, shared IPC contracts, custom `smart-terminal://` protocol for the production renderer, smoke mode.
- Verification: `npm run lint`, `npx tsc -p tsconfig.json --noEmit`, `npm run build`, `SMART_TERMINAL_SMOKE=1 npx electron apps/desktop` with `hasApi: true` and rendered Angular UI.
- Deviations: build tooling (esbuild, concurrently, wait-on, cross-env) and runtime details recorded in `docs/10 - Config locale, coordinatore e sicurezza runtime.md`. No database or remote service added.
