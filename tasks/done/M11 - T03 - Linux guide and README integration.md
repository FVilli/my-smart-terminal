---
title: "M11 - T03 - Linux guide and README integration"
type: task
project: smart-terminal
created: 2026-10-23
id: "M11-T03"
milestone: "M11"
depends_on: "M11-T01, M11-T02"
deliverables: "Updated Linux guide with one-command install/remove, menu/icon explanation, README logo and consistent docs"
---
<!-- gsynchro:v1 id=e9f4ae4c-e412-4b3f-b596-36eab127f46f registered=2026-10-23T20:20:48.262Z -->

# M11 - T03 - Linux guide and README integration

## Objective
Document the new one-command experience clearly for non-experts and connect the branding.

## Constrained implementation
- Update `docs/21 - Linux installation guide.md`: put the tagged `curl -fsSL https://raw.githubusercontent.com/FVilli/my-smart-terminal/v1.1.1/install.sh | sh` command first, explain what it does and the security trade-off, show the download-and-inspect alternative, `--deb`/`--appimage`, Ubuntu menu/icon behavior, update, removal command, data preservation and current manual fallback.
- Keep the `.deb` and AppImage manual instructions as troubleshooting/fallback, but remove duplicate installation blocks where the script covers them.
- Update README only for branding/documentation; keep the installation section exactly the three guide links. Add the Linux one-command to the Linux guide, not as a fourth README install option.
- Cross-link the Linux guide from README/manual/onboarding as before; ensure docs/12/14 still delegate installation.
- Update version references to v1.1.1 only where they describe the current release; preserve historical notes.

## Acceptance criteria
- One-liners use the tag URL, are copy-pasteable, and explain `curl | sh` risk and script inspection.
- Guide covers menu icon, AppImage XDG integration, uninstall/data preservation and troubleshooting.
- README installation section still exactly three guide links; logo displays.
- `test:docs-links` and `test:install-docs` pass; no stale v1.1.0 install commands in current instructions.

## References
docs/21; README; docs/12; docs/14; M11 scripts.

## Do not
Do not change app behavior or delete user data; do not put a fourth install link in README's install section.

## Outcome
- Rewrote docs/21 around the pinned v1.1.1 one-command installer/uninstaller, with `--deb`/`--appimage`, inspect-first alternative, Ubuntu menu/icon behavior, manual fallback, data preservation and troubleshooting.
- Removed the competing long installation blocks; kept only a short manual fallback.
- Updated the installation-doc verifier to allow only the exact pinned FVilli/my-smart-terminal install/uninstall URLs, while still rejecting arbitrary curl-to-shell commands.
- README installation section remains exactly three OS links; docs checks and 10 Bash blocks pass.
