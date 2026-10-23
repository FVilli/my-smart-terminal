---
title: "M05 - T02 - Three-step onboarding"
type: task
project: smart-terminal
created: 2026-10-22
id: "M05-T02"
milestone: "M05"
depends_on: "T01"
deliverables: "Three-step onboarding"
---
<!-- gsynchro:v1 id=1a8d96f1-3590-4d1d-92fd-72d28bf84871 registered=2026-10-23T07:58:08.886Z -->

# M05 - T02 - Three-step onboarding

## Objective
Three-step onboarding.

## Constrained implementation
Configure the repository, machine name, and AI provider; verify connectivity and permissions.

## Acceptance criteria
Persist setup in non-secret Markdown and use the keychain for credentials.

## References
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce databases, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: validated Markdown config with backup/quarantine, env>config>default precedence, safeStorage SecretStore with basic_text→memory policy, 3-step wizard (repository/machine, AI, STT with microphone verification and skip), token storage only in the keychain, restartRequired, `SMART_TERMINAL_USER_DATA`.
- Verification: onboarding smoke across three launches (wizard, restart without wizard, skip), config.md without token, repository/machine applied; 319 tests.
- Deviations: the wizard does not appear when `SMART_TERMINAL_DATA_REPO` is set (smoke/dev); `restartRequired` also applies when changing the remote; synchronous safeStorage is deprecated in Electron 45.
