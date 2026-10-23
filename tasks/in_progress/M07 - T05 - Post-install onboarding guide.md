---
title: "M07 - T05 - Post-install onboarding guide"
type: task
project: smart-terminal
created: 2026-10-23
id: "M07-T05"
milestone: "M07"
depends_on: "T01,T04"
deliverables: "Post-install onboarding guide"
---
<!-- gsynchro:v1 id=175b4504-ad0d-4519-b37c-403349e47125 registered=2026-10-23T10:19:23.501Z -->

# M07 - T05 - Post-install onboarding guide

## Objective
Document clearly what a new user must do immediately after installing the app.

## Constrained implementation
Add an English step-by-step guide (with real screenshots) covering first launch, data repository and machine name, optional AI provider/token, optional STT/microphone permission, skipping options, first local session, first SSH session, enabling clipboard, verifying Git sync, where config/secrets live, and recovery from denied permissions or missing keyring. Link it from README and docs/12.

## Acceptance criteria
A new user can complete setup and run the first command by following the guide; commands, paths and UI labels match the real app; screenshots match the English UI; no unsupported claims.

## References
docs/12; docs/10; onboarding code and smoke.

## Do not
Do not include real tokens or personal data in screenshots or examples.
