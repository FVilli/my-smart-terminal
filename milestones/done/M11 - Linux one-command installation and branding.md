---
title: "M11 - Linux one-command installation and branding"
type: milestone
project: smart-terminal
created: 2026-10-23
id: "M11"
goal: "Make Linux installation a safe one-command experience from the public repository, with Ubuntu menu integration, a new installation icon and README logo, verified by a v1.1.1 release."
depends_on: "M10"
---

# M11 - Linux one-command installation and branding

## Goal
A Linux user can install or remove Smart Terminal with a documented `curl ... | sh` command, get an Ubuntu applications-menu entry with the new icon, and see the new logo in README. The .deb remains the recommended Ubuntu/Debian path; AppImage gets per-user XDG menu integration.

## Scope
- Root `install.sh` and `uninstall.sh`, safe for `curl | sh`, checksum-verified, no destructive defaults.
- New Linux icon from the supplied PNG, README logo cropped from the supplied concept sheet, and Linux packaging icon configuration.
- Updated Linux guide and README branding; keep M10's three-link README installation rule.
- v1.1.1 release with rebuilt Linux artifacts so the .deb carries the new icon.
- Automated checks and independent security/clarity review.

## Non-goals
- No macOS/Windows icon changes.
- No app behavior changes.
- No deletion of `~/.config/my-smart-terminal` or external data repositories by uninstall scripts.
- No signing/notarization claims.

## Acceptance
Scripts are POSIX-sh syntax-valid, safe under `curl | sh`, checksum-verified, idempotent, and tested with fake system commands. Linux `.deb` and AppImage contain/show the new icon; guide and README are consistent; v1.1.1 assets and checksums are verified.
