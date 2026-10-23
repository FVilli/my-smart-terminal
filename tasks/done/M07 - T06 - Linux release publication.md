---
title: "M07 - T06 - Linux release publication"
type: task
project: smart-terminal
created: 2026-10-23
id: "M07-T06"
milestone: "M07"
depends_on: "T01,T02,T03,T04,T05,T10"
deliverables: "Linux release publication"
---
<!-- gsynchro:v1 id=dec7d6f0-a6f4-4d13-aed7-a59e9a6f642b registered=2026-10-23T10:19:23.502Z -->

# M07 - T06 - Linux release publication

## Objective
Publish verified Linux AppImage and .deb artifacts for v1.0.0.

## Constrained implementation
Build with the release configuration, verify packaged app and AppImage with smoke tests on Xvfb, generate SHA256SUMS, validate desktop entry/icon and document unsigned status. Attach artifacts to the GitHub release.

## Acceptance criteria
AppImage and .deb download successfully from the release; checksums match; packaged app starts and reaches the terminal; installation instructions work on Ubuntu.

## References
docs/09; electron-builder.yml; release workflow.

## Do not
Do not claim the artifacts are signed.

## Outcome
- v1.0.0 published on GitHub Releases: AppImage and .deb.
- CI Linux job green (lint, typecheck, tests, Electron smokes, package, checksums).
- Downloaded AppImage verified against SHA256SUMS and launched with smoke test on Xvfb; English UI confirmed.
- Launch instructions documented for AppImage, .deb (`/opt/Smart Terminal/smart-terminal`) and applications menu.
