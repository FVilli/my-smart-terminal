---
title: "M06 - T03 - Packaging and manual"
type: task
project: smart-terminal
created: 2026-10-22
id: "M06-T03"
milestone: "M06"
depends_on: "T02"
deliverables: "Packaging and manual"
---
<!-- gsynchro:v1 id=b4f39d47-70d4-40f7-a971-447da9c33764 registered=2026-10-23T07:58:12.330Z -->

# M06 - T03 - Packaging and manual

## Objective
Packaging and manual.

## Constrained implementation
Build Linux/macOS/Windows according to available CI; installation and troubleshooting guides.

## Acceptance criteria
Runnable artifacts where a runner is available; manual procedures documented.

## References
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce databases, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: version 1.0.0, electron-builder config (AppImage/.deb, dmg, NSIS, asar/node-pty, icon), package:linux/mac/win/dir scripts, SHA-256 checksums, Linux/macOS/Windows CI matrix and tag release workflow, user manual/README/release notes.
- Verification: `npm run package:linux` produces AppImage and .deb; `release/linux-unpacked` and AppImage launched with smoke tests on Xvfb; `npm run checksums` generates SHA256SUMS; docs/09 updated. macOS/Windows delegated to native pipelines.
- Notes: unsigned artifacts, no auto-update; icon generated locally; `latest-linux.yml` is builder metadata, excluded from checksums.
