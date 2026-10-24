---
title: "M19 - T03 - Debug UI and end-to-end test"
type: task
project: smart-terminal
created: 2026-10-25
id: "M19-T03"
milestone: "M19"
depends_on: "M19-T02"
deliverables: "REC/STOP/PLAY/TRANSCRIBE UI with concise summary and expandable sanitized debug details"
---

# M19 - T03 - Debug UI and end-to-end test

## Objective
Let a non-expert see microphone/audio state and a developer see why transcription did not work.

## Constrained implementation
- Under STT controls show recorded duration/bytes, playback state and TRANSCRIBE summary.
- Summary states service reached/not reached and HTTP status when available; expandable copyable details show safe diagnostics.
- Keep operational notices in the footer message area; do not duplicate errors in random places.
- Preserve simplified shared-AI provider/model/language settings.
- Update STT setup smoke to exercise REC/STOP/PLAY/TRANSCRIBE and debug fields.

## Acceptance
Debug panel is understandable, sanitized and copyable; real failure stages visible; UI state transitions tested.

## Outcome
- REC/STOP/PLAY/TRANSCRIBE flow implemented with duration/bytes, permission/device/recorder-specific errors and cleanup.
- Sanitized SttDiagnostics propagated through adapter/service/IPC: serviceReached only after HTTP response, status/content type/JSON validity/stage/elapsed/endpoint/model/language/audio metadata.
- REC works without AI config; TRANSCRIBE requires provider. Electron permission checks restricted to trusted window/audio.
- Debug details panel under STT controls; footer message area used for operational notices.
- Focused unit (407), lint, typecheck, build, STT setup/editor/settings/onboarding/layout smokes and Linux package passed.
- Real device/provider still requires user verification; mocks are not claimed as real Unsloth proof.
