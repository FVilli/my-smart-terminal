---
title: "M07 - T09 - GitHub release and download verification"
type: task
project: smart-terminal
created: 2026-10-23
id: "M07-T09"
milestone: "M07"
depends_on: "T06,T07,T08"
deliverables: "GitHub release and download verification"
---

# M07 - T09 - GitHub release and download verification

## Objective
Publish the v1.0.0 GitHub release and verify every download path.

## Constrained implementation
Push the English-only repository and tag v1.0.0; let the release workflow build all platforms; verify release assets, SHA256SUMS, notes and links; update README/manual with the final URL; confirm no unsigned/signed claims are wrong. Record the release URL and asset list.

## Acceptance criteria
`https://github.com/FVilli/my-smart-terminal/releases/latest` shows Linux AppImage, .deb, macOS .dmg and Windows .exe plus checksums; README and manual links resolve; a clean download installs and starts on each available platform.

## References
docs/09; .github/workflows/release.yml; README.md.

## Do not
Do not publish from an untrusted branch or skip verification.
