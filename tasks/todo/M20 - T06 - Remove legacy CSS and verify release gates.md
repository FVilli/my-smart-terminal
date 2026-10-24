---
title: "M20 - T06 - Remove legacy CSS and verify release gates"
type: task
project: smart-terminal
created: 2026-10-24
id: "M20-T06"
milestone: "M20"
depends_on: "M20-T05"
deliverables: "Clean styling tree, completed regression evidence and updated documentation"
---
<!-- gsynchro:v1 id=aa410927-1fd3-4143-aa42-09aa3f4fb036 registered=2026-10-24T17:27:37.158Z -->

# M20 - T06 - Remove legacy CSS and verify release gates

## Objective
Remove redundant styling and independently verify no functional or visual regression.

## Implementation
- Delete unused rules, dead style files, duplicated tokens and temporary migration hooks; retain only necessary scoped CSS and xterm rules.
- Search for stray hard-coded palette colors, `!important`, static inline styles and accidental global overrides; document justified exceptions.
- Run unit tests, lint, typecheck, production renderer build, Electron smoke and available Linux package validation; manually inspect Windows/macOS when pipelines are available.
- Compare before/after 1440×900 and 1024×700 plus zoom 50%, 100%, 200%; validate visual layout, terminal fit, tab behavior, sidebar, composer, STT and settings.
- Update `docs/06 - Stack and code structure.md`, `docs/15 - Visual baseline.md` and any other affected docs only to describe verified implementation; write concise evidence and residual caveats.

## Acceptance
No unused legacy styling system remains; documented checks pass or are explicitly blocked with evidence; functional keyboard, IPC, Git/PTY and security behavior unchanged.
