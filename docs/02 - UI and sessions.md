---
title: "UI and sessions"
type: spec
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=0c18662a-8789-43bb-89e5-08f13400756c registered=2026-10-23T07:57:43.848Z -->

# UI and sessions

## Visual baseline
Immutable reference: `mockups/Smart Terminal - final mock.png` (image supplied by the user). 75% terminal / 25% sidebar layout, dark theme, terminal and input in a monospace font.

## Behavior
Top tabs for local and SSH sessions; `+` opens a Local/alias choice from `~/.ssh/config`. Active PTYs remain active even when their tab is not focused. Sidebar with alternative Clipboard/History tabs, search, and machine filter. History includes all synchronized machines.

## Assisted input
Editor anchored at the bottom, per-session draft, AI correction on the left, microphone and `Voice ready` at the bottom right. Deliberate submission to the PTY; the native terminal always remains usable.

## Footer status
`GitHub synced` (with syncing/offline/error states) and `Primary instance` icon lit only for the local leader; read-only indicator, updated through IPC.
