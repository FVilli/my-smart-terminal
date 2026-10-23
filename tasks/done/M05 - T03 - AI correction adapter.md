---
title: "M05 - T03 - AI correction adapter"
type: task
project: smart-terminal
created: 2026-10-22
id: "M05-T03"
milestone: "M05"
depends_on: "T02"
deliverables: "AI correction adapter"
---
<!-- gsynchro:v1 id=93259279-5635-4f29-a0de-556c83c478db registered=2026-10-23T07:58:09.673Z -->

# M05 - T03 - AI correction adapter

## Objective
AI correction adapter.

## Constrained implementation
Anthropic, OpenAI, and local providers; typo-only prompts and review before sending.

## Acceptance criteria
No shell-command correction; timeout fallback; paths/code preserved in tests.

## References
`docs/01 - Architecture.md`; `docs/02 - UI and sessions.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI, voice and security.md`.

## Do not
Do not introduce databases, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed (after two partial workers; integration finalized by the parent).
- Implemented: AI library (constrained prompt, conservative shell detection, Anthropic/OpenAI/OpenAI-compatible adapters, timeout/fallback), main `AiService` with dynamic config/tokens and test mode, `ai:status`/`ai:correct` IPC, preload, `AiStore`, AI button with review and no auto-send.
- Verification: 330 tests, adapter with fake fetch/timeout, `test:ai-smoke` with status, correction, review warning, no send, shell skipped; editor/sidebar/tabs/layout smoke tests passed.
- Deviations: deterministic test mode only for smoke tests (`SMART_TERMINAL_AI_TEST_MODE=1`); conservative shell detection (better to skip than alter a command).
