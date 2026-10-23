---
title: "M10 - T01 - Windows guide and README policy"
type: task
project: smart-terminal
created: 2026-10-23
id: "M10-T01"
milestone: "M10"
depends_on: "M09"
deliverables: "Windows installation/uninstallation guide and README installation-link policy"
---
<!-- gsynchro:v1 id=m10-t01-windows-readme registered=2026-10-23T15:35:00.000Z -->

# M10 - T01 - Windows guide and README policy

## Objective
Give a non-expert Windows 11 user a complete, calm path from download to removal, and make README's installation section only three guide links.

## Constrained implementation
Create `docs/20 - Windows installation guide.md`. Cover: supported release (Windows x64, unsigned), download from GitHub latest release, optional SHA256 verification using PowerShell, per-user NSIS wizard, SmartScreen warning (source/checksum first; do not disable security), first launch/onboarding, data locations, update by installing a newer release, uninstall through Windows Settings or the Start-menu uninstaller, optional data cleanup with explicit warnings, and troubleshooting. Distinguish app uninstall from local app data (`%APPDATA%\my-smart-terminal`) and from the user's separate data repository. Do not tell users to run arbitrary remote scripts or bypass security controls.

In README replace the entire Download/install quick-start section with only three prominent links labeled exactly: Windows installation guide, Linux installation guide, macOS installation guide. Keep the rest of README (overview, screenshots, features, security, development, documentation). Link the new Windows guide.

## Acceptance criteria
- Guide is English-only and understandable without terminal expertise.
- Exact Windows artifact (`Smart.Terminal-1.1.0-win-x64.exe`), per-user install behavior, uninstall routes, and `%APPDATA%\my-smart-terminal` are correct.
- README installation section has exactly the three guide links and no version-pinned artifact commands.
- Local Markdown links resolve; no stale `Smart Terminal` userData path.

## References
README.md; docs/12; docs/14; electron-builder.yml; docs/18; docs/19.

## Do not
Do not modify app code, packaging, release artifacts or the data repository; do not claim code signing or auto-update.
