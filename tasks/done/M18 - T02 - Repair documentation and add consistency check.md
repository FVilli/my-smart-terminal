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
<!-- gsynchro:v1 id=556530d9-9efa-4445-9a58-48899ec24a0e registered=2026-10-24T17:17:12.610Z -->

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

## Outcome
- All uninstall commands now use `main/uninstall.sh` with explicit version-independent rationale; install commands remain pinned to v1.3.0.
- docs/11 rewritten to current contracts, including window controls, setupTestAi and STT fields; Italian remnants removed.
- docs/13 expanded; docs/26/25 framed as historical; Windows/macOS pinned-release wording and Linux fallback fixed.
- Added `scripts/verify-doc-consistency.mjs` + `test:doc-consistency` + CI; docs links/install docs/consistency checks pass.
