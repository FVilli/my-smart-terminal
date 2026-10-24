---
title: "M19 - STT recording and provider diagnostics"
type: milestone
project: smart-terminal
created: 2026-10-25
id: "M19"
goal: "Make the STT test flow work independently of AI configuration, expose actionable microphone/MediaRecorder states, and return safe deep diagnostics about whether the transcription provider was reached and what it returned."
depends_on: "M18"
---
<!-- gsynchro:v1 id=5e4cd6c2-7fee-4061-a56c-63dbbaf2ede8 registered=2026-10-24T17:17:12.605Z -->

# M19 - STT recording and provider diagnostics

## Scope
Settings STT test: permission/capture lifecycle, REC/STOP/PLAY/TRANSCRIBE, in-memory audio cleanup, sanitized provider diagnostics, tests and documentation. Production dictation behavior must remain unchanged.

## Non-goals
No new model discovery or dependencies; no token/audio/body leaks; no claim of real microphone/provider success from mocks alone.

## Acceptance
REC works without AI config; TRANSCRIBE reports a safe stage/HTTP status/serviceReached; permission and device errors are specific; STOP recovers; PLAY/audio cleanup works; focused Linux build and tests pass; manual real-device/provider caveat documented.
