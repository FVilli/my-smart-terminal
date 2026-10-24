---
title: "M18 - T02 - Repair documentation and add consistency check"
type: task
project: smart-terminal
created: 2026-10-24
id: "M18-T02"
milestone: "M18"
depends_on: "M18-T01"
deliverables: "Corrected docs, stable uninstall command, consistency checker and passing checks"
---

# M18 - T02 - Repair documentation and add consistency check

## Objective
Apply the audit repairs and prevent future version/command drift.

## Constrained implementation
- Update current commands: install pinned to v1.3.0; uninstall from `main` (version-independent), with a short rationale and a tag fallback for reproducibility.
- Correct current release/version, UI behavior, IPC/security and filenames.
- Mark historical mockup/hotfix versions as historical where needed.
- Add a no-dependency `scripts/verify-doc-consistency.mjs` (or extend existing checks) for current version references, README links, install/uninstall URL policy and stale current commands; add npm script/CI.
- No app code changes.

## Acceptance
Docs checks and new consistency check pass; uninstall no longer implies a version requirement; reviewer can verify the repair list.
