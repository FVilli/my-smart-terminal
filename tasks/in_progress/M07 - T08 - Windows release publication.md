---
title: "M07 - T08 - Windows release publication"
type: task
project: smart-terminal
created: 2026-10-23
id: "M07-T08"
milestone: "M07"
depends_on: "T01,T02,T03,T04,T05,T10"
deliverables: "Windows release publication"
---
<!-- gsynchro:v1 id=4ba22c62-6c3a-4845-9762-f859a4f3e3f6 registered=2026-10-23T10:19:23.503Z -->

# M07 - T08 - Windows release publication

## Objective
Produce and publish a working Windows installer for v1.0.0.

## Constrained implementation
Use the Windows GitHub Actions runner and electron-builder NSIS target; rebuild node-pty for Electron on Windows; verify installer creation and unsigned status; attach to release with checksum and installation notes. Do not cross-build from Linux (node-gyp cannot cross-compile node-pty).

## Acceptance criteria
The .exe installer is present on the release, checksummed, and its build log is green; installation steps and SmartScreen unsigned warning are documented.

## References
docs/09; release workflow; electron-builder.yml.

## Do not
Do not claim Windows code signing.
