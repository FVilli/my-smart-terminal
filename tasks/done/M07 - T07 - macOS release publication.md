---
title: "M07 - T07 - macOS release publication"
type: task
project: smart-terminal
created: 2026-10-23
id: "M07-T07"
milestone: "M07"
depends_on: "T01,T02,T03,T04,T05,T10"
deliverables: "macOS release publication"
---
<!-- gsynchro:v1 id=7419dcb0-9575-4da2-be7c-07aa2d7be87a registered=2026-10-23T10:19:23.502Z -->

# M07 - T07 - macOS release publication

## Objective
Produce and publish a working macOS .dmg for v1.0.0.

## Constrained implementation
Use the macOS GitHub Actions runner and electron-builder dmg target; rebuild node-pty for Electron on macOS; verify artifact creation and unsigned status; attach to release with checksum and installation notes. If no macOS runner is available, document the blocker instead of publishing an unverified artifact.

## Acceptance criteria
The .dmg is present on the release, checksummed, and its build log is green; installation steps for unsigned apps are documented honestly.

## References
docs/09; release workflow; electron-builder.yml.

## Do not
Do not claim Apple signing/notarization.

## Outcome
- macOS build job green on GitHub Actions; `Smart.Terminal-1.0.0-mac-arm64.dmg` published (Apple Silicon).
- SHA-256 verified against the published SHA256SUMS.
- Artifact is unsigned; installation/Gatekeeper instructions documented.
- Limitation: the current release has an arm64 DMG only; Intel macOS is not yet published.
