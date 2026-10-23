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

## Implementazione v1.0.0
- Versione `1.0.0` in root/desktop/renderer; `electron-builder` in `electron-builder.yml` con:
  - Linux: AppImage e `.deb` (`npm run package:linux`), icona `apps/desktop/build/icon.png`, `executableName smart-terminal`, `syncDesktopName`.
  - macOS: `.dmg`; Windows: installer NSIS. Costruiti dalle rispettive pipeline native (la build locale Linux produce solo artefatti Linux).
  - `asar: true`, `node-pty` in `asarUnpack`, rebuild nativo per Electron, `artifactName` con nome/versione/os/arch.
- `npm run package:dir` per una verifica rapida; `npm run checksums` genera `release/SHA256SUMS` escludendo metadati di update.
- CI: `.github/workflows/ci.yml` (matrice Linux/macOS/Windows, `npm ci`, lint, typecheck, test, coordinator, build, rebuild nativo, smoke Linux su Xvfb, package, checksums, upload artefatti). `.github/workflows/release.yml` su tag `v*` pubblica gli artefatti e `SHA256SUMS` con `GITHUB_TOKEN`; nessun rilascio da PR.
- Smoke artifact Linux verificato con AppImage `--appimage-extract-and-run` e variabili `SMART_TERMINAL_SMOKE=1` su display virtuale.
- Gli artefatti V1 sono **non firmati**; nessun auto-update. Pubblicare sempre `SHA256SUMS` e la nota unsigned. La versione dell'app è `1.0.0`, tag atteso `v1.0.0`.

## Aggiornamenti e compatibilità
Lo schema frontmatter Markdown ha un campo `schema_version`; una nuova versione dell'app deve leggere gli schemi precedenti o eseguire migrazioni esplicite con backup. Non modificare contenuti sincronizzati in modo distruttivo durante upgrade automatici.
