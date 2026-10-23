---
title: "M11 - T02 - Linux install and uninstall scripts"
type: task
project: smart-terminal
created: 2026-10-23
id: "M11-T02"
milestone: "M11"
depends_on: "M10"
deliverables: "Root install.sh and uninstall.sh, POSIX-safe curl|sh behavior, fake-command tests and CI checks"
---

# M11 - T02 - Linux install and uninstall scripts

## Objective
Provide safe, repeatable one-command Linux installation and removal from the public repository.

## Constrained implementation
- Create root `install.sh` and `uninstall.sh` (POSIX sh, usable via `curl -fsSL ... | sh`).
- `install.sh`: require a normal user (sudo only for Debian package install), x86_64 only, pinned `VERSION=1.1.1` with env override, detect Debian/Ubuntu `.deb` vs AppImage, download from the tagged release, verify only the exact artifact against `SHA256SUMS`, install with `sudo apt-get install -y` on Debian/Ubuntu, or install the AppImage plus XDG `.desktop` and icon for the current user on other distributions. Support `--appimage`/`--deb` explicitly. Never prompt for input; no `curl | bash` inside.
- AppImage menu entry: executable under `${XDG_BIN_HOME:-$HOME/.local/bin}`, icon under `${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/512x512/apps/smart-terminal.png`, `.desktop` under `.../applications/smart-terminal.desktop` with `Name=Smart Terminal`, `Exec=` absolute quoted path, `Icon=smart-terminal`, `Terminal=false`, `Categories=Development;`, `StartupWMClass=smart-terminal`; run `update-desktop-database`/`gtk-update-icon-cache` only if available.
- `uninstall.sh`: remove the detected `.deb` package with apt, and/or remove only the AppImage executable/desktop/icon created by the install script; never remove `~/.config/my-smart-terminal` or external data repositories. Non-interactive; no `rm -rf` of user data.
- Both scripts: `set -eu`, clear errors, trap temp cleanup, retry downloads, no secrets, no destructive defaults, idempotent behavior.
- Add `scripts/verify-linux-install-scripts.mjs` with `sh -n`, unsafe-pattern checks, and fake-PATH end-to-end tests for deb, AppImage, and uninstall without touching the real system. Add npm script `test:linux-install` and CI step.

## Acceptance criteria
- `shellcheck` if available and `sh -n` pass; fake-command tests prove: deb checksum/apt path, AppImage menu/icon path, uninstall does not delete user data.
- Scripts work when stdin is a pipe and do not consume the piped script.
- No new dependencies; English comments/messages only.
- No app/release changes in this task.

## References
M10 docs/21; electron-builder.yml; scripts/check-links.mjs; docs/13.

## Do not
Do not remove the app data folder or external repositories; do not run as root; do not add arbitrary remote execution.

## Outcome
- Root `install.sh` and `uninstall.sh` (POSIX sh): normal-user guard, x86_64 check, pinned v1.1.1 with env override, `--deb`/`--appimage`, checksum verification, apt only for .deb with stdin redirected, XDG AppImage install + icon + desktop entry, cache refresh, data-preserving uninstall.
- Added `scripts/verify-linux-install-scripts.mjs` and `test:linux-install`; fake-PATH tests cover deb, AppImage menu/files, piped stdin and uninstall preserving a sentinel user-data folder. CI runs it.
- Fixed the initial fake AppImage pattern and replaced the permissive uninstall `|| :` with an explicit package-status check.
- Guard added against installing the AppImage over an existing `.deb` to avoid duplicate menu entries.
