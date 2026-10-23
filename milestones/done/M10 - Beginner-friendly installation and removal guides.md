---
title: "M10 - Beginner-friendly installation and removal guides"
type: milestone
project: smart-terminal
created: 2026-10-23
id: "M10"
goal: "Make installation and removal understandable and safe for non-expert users on Windows, Linux and macOS, with one authoritative guide per OS and only three installation links in README."
depends_on: "M09"
---
<!-- gsynchro:v1 id=ff802efc-78ed-4236-90df-93ed8e72aa87 registered=2026-10-23T13:29:31.216Z -->

# M10 - Beginner-friendly installation and removal guides

## Goal
Help a non-expert download, install, launch, update and remove Smart Terminal on each supported OS without breaking their sessions or data. README becomes a friendly entry point: its installation section contains only the three OS guide links.

## Scope
- Three detailed English guides: Windows, Linux, macOS.
- README installation section: exactly the three guide links.
- Safe copy-paste commands for Linux and macOS; PowerShell guidance for Windows.
- Clear distinction between removing the app and deleting local app data / the data repository.
- Cross-document cleanup, link checks and independent review.

## Non-goals
- No app behavior, packaging, signing, notarization or auto-update changes.
- No release bump unless a real app change becomes necessary.
- No commands that disable OS security, bypass Gatekeeper, or delete user data by default.

## Tasks
M10-T01 Windows guide and README policy; M10-T02 Linux guide and installer block; M10-T03 macOS guide and safe helper; M10-T04 cross-guide integration and verification.

## Acceptance
All tasks done; README has exactly three installation links; every guide covers install, first launch, unsigned warning, update, uninstall, data separation and troubleshooting; docs links pass; reviewer and evidence-auditor approve non-expert clarity and platform-claim safety.
