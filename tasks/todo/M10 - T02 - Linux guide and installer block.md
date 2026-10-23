---
title: "M10 - T02 - Linux guide and copy-paste installer"
type: task
project: smart-terminal
created: 2026-10-23
id: "M10-T02"
milestone: "M10"
depends_on: "M09"
deliverables: "Linux installation/uninstallation guide with safe copy-paste install and removal commands"
---
<!-- gsynchro:v1 id=83c549f3-0cca-4bcb-a7a4-95fa9be40687 registered=2026-10-23T13:29:31.213Z -->

# M10 - T02 - Linux guide and copy-paste installer

## Objective
Let a non-expert Ubuntu/Debian user install, launch, update and remove Smart Terminal with commands they can paste safely.

## Constrained implementation
Create `docs/21 - Linux installation guide.md`. Recommend `.deb` for Ubuntu/Debian and explain AppImage for other distributions. Include a directly pasteable Bash block that:
- sets `VERSION=1.1.0` visibly (future releases update it);
- uses `set -euo pipefail` and a temporary directory with cleanup;
- downloads the `.deb` and `SHA256SUMS` from the release;
- verifies only the exact artifact checksum and fails clearly;
- installs with `sudo apt install ./<file>.deb` (dependencies resolved);
- does not run the whole script as root and does not delete app data.
Include AppImage download/checksum/chmod/run block and the `--appimage-extract-and-run` fallback, without asserting a single FUSE package name for every distro.

Cover application-menu launch, update, uninstall (`sudo apt remove smart-terminal`; explain `purge` does not remove user data), local data (`~/.config/my-smart-terminal`, including the default `data/` repo), optional backup/cleanup with explicit warnings, and troubleshooting.

## Acceptance criteria
- Commands are shell-safe, version-pinned, checksum-verified, and non-destructive by default.
- No command disables security or recursively deletes data automatically.
- Guide is English-only and understandable to a non-expert.
- `bash -n` passes for extracted code blocks and Markdown links resolve.

## References
README.md; docs/12; docs/14; electron-builder.yml; docs/18.

## Do not
Do not add dependencies, app changes, or a destructive uninstall script.
