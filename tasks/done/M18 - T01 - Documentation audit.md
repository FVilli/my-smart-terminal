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
<!-- gsynchro:v1 id=6504d4c9-acb3-4049-a155-4940138a0201 registered=2026-10-24T17:17:12.610Z -->

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

## Outcome
- Audit found: uninstall URLs wrongly pinned to v1.3.0; docs/11 IPC table/STT section obsolete and partly Italian; docs/26/25 historical version context unclear; docs/13 missing current setupTestAi/STT contract checks; pinned-vs-latest wording in OS guides; AppImage placeholder command; no current-version consistency gate.
- Uninstall from `main` is safe with the current version-independent script; install remains pinned to v1.3.0.
