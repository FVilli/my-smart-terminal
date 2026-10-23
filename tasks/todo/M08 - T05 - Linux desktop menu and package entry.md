---
title: "M08 - T05 - Linux desktop menu and package entry"
type: task
project: smart-terminal
created: 2026-10-23
id: "M08-T05"
milestone: "M08"
depends_on: "T04"
deliverables: "Linux desktop menu and package entry"
---
<!-- gsynchro:v1 id=bc732635-25a9-4d40-b12a-f531b0712611 registered=2026-10-23T12:22:14.926Z -->

# M08 - T05 - Linux desktop menu and package entry

## Objective
Guarantee that installing the Linux package adds a visible, working application-menu entry.

## Constrained implementation
Verify the electron-builder desktop entry, icon, executable and `StartupWMClass`; ensure the `.deb` installs `smart-terminal.desktop` and the icon under the expected hicolor path. Add a packaging check that inspects the `.deb` (and AppImage metadata where available) and validates the desktop entry syntax when `desktop-file-validate` is present. Document menu launch and the `/opt/Smart Terminal/smart-terminal` fallback.

## Acceptance criteria
`dpkg-deb -c` shows the desktop file and icon; the desktop entry launches the app; the menu item appears after install (documented and verified on Ubuntu); packaging CI checks the entry; README/manual/onboarding guide remain accurate.

## References
electron-builder.yml; docs/09; docs/12; docs/14; release artifacts.

## Do not
Do not require root at runtime or add a `/usr/bin` wrapper without documenting it.
