---
title: "Vision and scope"
type: spec
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=9636ca63-18a7-4e49-af25-3d7c3266893c registered=2026-10-23T07:57:42.289Z -->

# Vision and scope

## Objective
Multi-instance desktop terminal for local shells and SSH, with clipboard, dictation, typo correction, globally synchronized history, and reuse of Markdown as AI context.

## MVP scope
Real PTY, multi-session tabs, SSH host menu, optional assisted input, alternative clipboard/history, Markdown sessions, GitHub sync, initial configuration, AI/STT providers.

## MVP exclusions
No database, no proprietary cloud, no automatic execution of commands corrected by the model, no heuristic interception of TUI prompts.

## Rule
Shell and PTY must work without network, AI, or GitHub.
