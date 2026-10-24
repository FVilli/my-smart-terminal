---
title: "M21 - Code quality and modern Angular refactoring"
type: milestone
project: smart-terminal
created: 2026-10-24
id: "M21"
goal: "Standardize code quality rules and refactor existing code for readability, coherence, brevity and maintainability without functional changes."
depends_on: "M20"
---
<!-- gsynchro:v1 id=5e53d0b9-cde1-438a-ad4e-8c3b8382270f registered=2026-10-24T22:31:29.291Z -->

# M21 - Code quality and modern Angular refactoring

## Purpose
Pure refactoring across Smart-Terminal. First establish enforceable rules for every worker; only then refactor incrementally. Public behavior, accessibility, performance expectations, UI and data contracts must remain equivalent.

## Non-negotiable constraints
- No new features, product behavior changes, API/IPC changes, persistence schema changes, provider changes, dependency upgrades or styling redesign.
- Preserve Electron main/preload isolation, xterm/PTY keyboard and lifecycle, STT/audio, AI, Git coordination, multi-instance, platform support, and M20 Tailwind token conventions.
- Prefer clarity over minimum line count; no pointless abstractions, wholesale rewrites or speculative architectural changes.
- Do not silently replace RxJS with signals: choose based on state ownership and asynchronous semantics; no forced migrations.
- Comments must explain intent, invariants, security constraints and non-obvious decisions, not repeat the implementation.
- Follow the installed Angular version and official Angular style guide; prohibit version-incompatible API changes.

## Mandatory execution sequence
T01 general coding rules → T02 Angular-specific practices → T03 commenting/documentation rules → T04 automated checks and inventory → T05 renderer refactor → T06 Electron/shared package refactor → T07 tests consolidation → T08 independent verification.

T01–T04 are the governance gate. No implementation refactor begins until the rules are published and the baseline is recorded.

## Completion
All workers follow the published documents; refactor commits are small and scoped; existing tests plus new characterization tests pass; static checks are enforceable; no externally observable behavior regression or changed visual baseline; final audit records before/after complexity, duplications, exceptions and remaining debt.

## References
- `docs/WORKFLOW.md`
- `docs/06 - Stack and code structure.md`
- `docs/02 - UI and sessions.md`
- `docs/15 - Visual baseline.md`
- `docs/23 - ADR assisted input and terminal keyboard behavior.md`
- Angular official style guide: https://angular.dev/style-guide
