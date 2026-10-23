---
title: "M06 - T03 - Packaging e manuale"
type: task
project: smart-terminal
created: 2026-10-22
id: "M06-T03"
milestone: "M06"
depends_on: "T02"
deliverables: "Packaging e manuale"
---
<!-- gsynchro:v1 id=b4f39d47-70d4-40f7-a971-447da9c33764 registered=2026-10-23T07:58:12.330Z -->

# M06 - T03 - Packaging e manuale

## Obiettivo
Packaging e manuale.

## Implementazione vincolata
Build Linux/macOS/Windows secondo CI disponibile; guide install e troubleshooting.

## Criteri di accettazione
Artefatti avviabili dove runner presente; procedure manuali documentate.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: version 1.0.0, electron-builder config (AppImage/.deb, dmg, NSIS, asar/node-pty, icona), script package:linux/mac/win/dir, checksums SHA-256, CI matrice Linux/macOS/Windows e release workflow su tag, manuale utente/README/release notes.
- Verifica: `npm run package:linux` produce AppImage e .deb; `release/linux-unpacked` e AppImage avviati con smoke su Xvfb; `npm run checksums` genera SHA256SUMS; docs/09 aggiornato. macOS/Windows demandati alle pipeline native.
- Note: artefatti non firmati, no auto-update; icona generata localmente; `latest-linux.yml` è metadato del builder, escluso dai checksum.
