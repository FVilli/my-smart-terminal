---
title: "M10 - T03 - macOS guide and safe download helper"
type: task
project: smart-terminal
created: 2026-10-23
id: "M10-T03"
milestone: "M10"
depends_on: "M09"
deliverables: "Apple Silicon macOS installation/uninstallation guide with safe download/checksum helper"
---
<!-- gsynchro:v1 id=f21ba249-970d-4d1f-aa45-322c8eca89ca registered=2026-10-23T13:29:31.214Z -->

# M10 - T03 - macOS guide and safe download helper

## Objective
Give a non-expert Apple Silicon user a safe path to install, open and remove Smart Terminal, including the unsigned-app warning.

## Constrained implementation
Create `docs/22 - macOS installation guide.md`. Cover: Apple Silicon only (arm64; Intel not supported by current asset), download from GitHub latest release, a pasteable Bash helper that downloads the DMG and `SHA256SUMS`, verifies only the DMG checksum, and opens the DMG in Finder; installation remains drag-to-Applications. Cover first launch via Finder contextual **Open** and the current Privacy & Security recovery path, without disabling Gatekeeper or stripping quarantine attributes.

Cover updates, moving the app to Trash, local data (`~/Library/Application Support/my-smart-terminal`, including default `data/`), optional cleanup with explicit warnings, and troubleshooting. Do not claim a universal cache/log path.

## Acceptance criteria
- Helper preserves normal macOS quarantine/Gatekeeper behavior and does not use `xattr -d`/`spctl --master-disable`.
- Guide clearly explains drag-to-Applications and the unsigned warning.
- English-only, non-expert language; Markdown links resolve; `bash -n` passes for code blocks.

## References
README.md; docs/12; docs/14; electron-builder.yml; docs/18.

## Do not
Do not add app changes, signing claims, Intel support, or destructive cleanup.
