---
title: "M19 - T01 - Capture and permission lifecycle"
type: task
project: smart-terminal
created: 2026-10-25
id: "M19-T01"
milestone: "M19"
depends_on: "M18"
deliverables: "Robust microphone permission and MediaRecorder state machine with actionable errors and cleanup"
---
<!-- gsynchro:v1 id=148dcfbe-45e1-42e1-9e3c-1122ed29d173 registered=2026-10-24T17:17:12.610Z -->

# M19 - T01 - Capture and permission lifecycle

## Objective
Make REC independent from AI configuration and make STOP/PLAY recoverable.

## Constrained implementation
- REC enabled whenever a running session/window allows it; TRANSCRIBE requires provider config.
- Explicit states: idle, requesting-permission, recording, stopping, ready, playing, error; disable only invalid actions.
- Request getUserMedia only from REC gesture; distinguish NotAllowed/Security, NotFound, NotReadable, Overconstrained, missing mediaDevices/MediaRecorder, unsupported MIME, recorder onerror and start/stop failure.
- Choose a supported MIME; use actual recorder MIME; cap duration/bytes; stop tracks; revoke Blob URL; ensure cleanup on retry, close and tab change.
- PLAY reports start/end/error; duration measured; nonempty Blob required.

## Acceptance
REC starts without AI settings; each failure has a distinct actionable message; STOP recovers; PLAY/TRANSCRIBE only with completed nonempty audio; no tracks/URLs leak.

## Outcome
- REC/STOP/PLAY/TRANSCRIBE flow implemented with duration/bytes, permission/device/recorder-specific errors and cleanup.
- Sanitized SttDiagnostics propagated through adapter/service/IPC: serviceReached only after HTTP response, status/content type/JSON validity/stage/elapsed/endpoint/model/language/audio metadata.
- REC works without AI config; TRANSCRIBE requires provider. Electron permission checks restricted to trusted window/audio.
- Debug details panel under STT controls; footer message area used for operational notices.
- Focused unit (407), lint, typecheck, build, STT setup/editor/settings/onboarding/layout smokes and Linux package passed.
- Real device/provider still requires user verification; mocks are not claimed as real Unsloth proof.
