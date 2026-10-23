---
title: Build e rilascio
project: smart-terminal
type: operations
version: 1
created: 2026-10-22
---
<!-- gsynchro:v1 id=e2904c0a-e3a9-4faf-bf84-72c71b93bdb9 registered=2026-10-23T07:57:49.384Z -->
# Build e rilascio

## Distribuzione
Prima release in canale manuale (artefatti scaricabili); niente auto-update in V1. Produrre pacchetti per Linux (AppImage e .deb), Windows (.exe installer) e macOS (.dmg). Usare `electron-builder` nel package desktop; versionamento SemVer e tag `vX.Y.Z`. Il rilascio su GitHub Releases riguarda il **repository del codice**; il repository delle sessioni è distinto.

## CI
GitHub Actions, matrice Linux/macOS/Windows: installazione riproducibile da lockfile, lint + typecheck, unit test, build Angular/Electron, test PTY e smoke test packaging. Test integrati multi-istanza/Git in un ambiente isolato, senza token reali. Nessun push/release da pull request non fidate. Su Linux gli smoke Electron girano su Xvfb (`scripts/run-electron.mjs`, display `:99`) e non sul desktop del runner; installare `xvfb` nella pipeline o usare il binario locale documentato in `docs/11`.

## Sicurezza rilascio
Artefatti con checksum SHA-256 pubblicati insieme alla release. Signing macOS/Windows solo quando sono disponibili i certificati; in assenza, indicare chiaramente la natura non firmata (mai dichiarare firmato un pacchetto non firmato). Secret CI protetti. Dipendenze native `node-pty` ricompilate per Electron e OS/architettura target.

## Gate di release
1. Test e packaging verdi sulle piattaforme dichiarate.
2. Verifica offline terminale, più finestre, elezione primary, recovery lock, sync Git con concorrenza e rifiuto push.
3. Nessuna credenziale nei Markdown o nei log di build.
4. UI confrontata con mock approvato, con monospace e layout 75/25.
5. Release notes: funzionalità, limitazioni, migrazione dati e istruzioni installazione.

## Aggiornamenti e compatibilità
Lo schema frontmatter Markdown ha un campo `schema_version`; una nuova versione dell'app deve leggere gli schemi precedenti o eseguire migrazioni esplicite con backup. Non modificare contenuti sincronizzati in modo distruttivo durante upgrade automatici.
