---
title: "M05 - T04 - STT and microphone"
type: task
project: smart-terminal
created: 2026-10-22
id: "M05-T04"
milestone: "M05"
depends_on: "T03"
deliverables: "STT and microphone"
---
<!-- gsynchro:v1 id=d7d1b986-9d09-449d-8374-b31c17ba1375 registered=2026-10-23T07:58:10.224Z -->

# M05 - T04 - STT and microphone

## Objective
STT and microphone.

## Constrained implementation
Cloud/local STT adapter with permissions and push-to-talk in the editor.

## Acceptance criteria
Permission/deny tests; editable result; no persisted audio.

## References
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce databases, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: `stt_command` config, local STT adapter (stdin, no shell/file) and OpenAI cloud adapter, main `SttService` with status/transcribe and test mode, IPC/preload, `SttStore` push-to-talk with permissions/deny, in-memory MediaRecorder, 60 s limit, editable result without auto-send, onboarding step 3 updated.
- Verification: 380 tests (50 new), STT smoke with deny, simulated dictation, no audio file in userData/repository, no overflow; build/lint/typecheck passed.
- Deviations: per-channel payload limit for audio; cloud uses the default OpenAI endpoint (base URL is an adapter/test option only); local command has no arguments (user wrapper); changing tabs halts and discards in-flight audio.
