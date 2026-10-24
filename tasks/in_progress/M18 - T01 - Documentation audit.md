---
title: "M18 - T01 - Documentation audit"
type: task
project: smart-terminal
created: 2026-10-24
id: "M18-T01"
milestone: "M18"
depends_on: "M17B"
deliverables: "Evidence-based audit of documentation coherence, version references and install/uninstall commands"
---

# M18 - T01 - Documentation audit

## Objective
Find contradictions between docs, scripts, current 1.3.0 behavior and historical version references.

## Constrained implementation
Read-only audit of README, docs/08-27, RELEASE_NOTES, CHANGELOG, hotfix log, install/uninstall scripts and screenshots. Check:
- current release/version references and artifact names;
- install tag vs uninstall versioning policy;
- header/input/settings/zoom/transparency behavior described accurately;
- IPC/security docs vs current contracts;
- stale filenames, links, paths and screenshots;
- historical references that could be mistaken for current commands.

## Acceptance
Return prioritized file/line findings and a concrete repair list; no edits.

## Do not
Do not change files in this task.
