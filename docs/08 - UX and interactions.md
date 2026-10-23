---
title: UX and interactions
project: smart-terminal
type: design
version: 1
created: 2026-10-22
---
<!-- gsynchro:v1 id=48cb6ca1-9a73-4164-b528-4204e5c909ba registered=2026-10-23T07:57:48.553Z -->
# UX and interactions

## Reference
Approved mockup: `mockups/Smart Terminal - final mock.png`. Do not change its hierarchy without an explicit decision: header; session tabs; output area; assisted input at the bottom; right history/clipboard bar.

## Layout
Terminal 75%, sidebar 25%, both columns `min-width:0`; on narrow windows, handle content overflow without changing the default ratio. Dark theme. xterm output and input editor **monospace** (`JetBrains Mono`, `Cascadia Code`, `monospace`); the surrounding UI may use sans-serif.

## Tabs and SSH
Each tab represents a distinct PTY and shows `S<n>` and its destination; `+` opens a menu with Local and SSH aliases read from `~/.ssh/config`. Switching tabs preserves the process, viewport, and draft. Closing a tab does not affect other sessions. After first run, the gear opens Settings with Repository, AI, STT, and Appearance tabs; Appearance selects monospace terminal font presets with installed-font fallback and live application before save. The window title shows the version; Linux and Windows omit the File/Edit/View/Window menu. Ctrl/Cmd-minus, plus, and 0 control application zoom, with the narrow PTY shortcut limitation described in the [keyboard ADR](23%20-%20ADR%20assisted%20input%20and%20terminal%20keyboard%20behavior.md).

## Input and sidebar
Assisted input is always visible at the bottom, AI correction on the left, mic + `Voice ready` at the bottom right. Pressing Enter performs a deliberate submission; Shift+Enter inserts a newline. Terminal keys, including arrows and Tab, pass through to the PTY. Correction applies only to natural-language prompts, not shell commands. The sidebar alternates between global History (search and machine filter) and Clipboard (copy/reinsert). The footer shows GitHub sync and a lit/unlit primary icon.

## Empty/error states
History with no results, an unconfigured repository, unreachable SSH, denied microphone, unavailable AI, absent primary, and offline sync must show a localized message without blocking terminal use.
