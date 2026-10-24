---
title: "M19 - T02 - Provider diagnostics contract"
type: task
project: smart-terminal
created: 2026-10-25
id: "M19-T02"
milestone: "M19"
depends_on: "M19-T01"
deliverables: "Sanitized STT diagnostics across adapter/service/IPC with reachability, HTTP status and error stage"
---

# M19 - T02 - Provider diagnostics contract

## Objective
Answer whether the transcription service responded and why it failed, without exposing secrets or audio.

## Constrained implementation
- Add bounded `SttDiagnostics` fields: stage, serviceReached (only after HTTP response), HTTP status, content type, JSON validity, elapsed ms, sanitized endpoint host/path, model, language, audio bytes/MIME/duration, text length, allowlisted error category.
- Propagate through OpenAI adapter/orchestrator/service/IPC.
- Distinguish unconfigured/missing token, DNS/network/refused/TLS, timeout, HTTP 4xx/5xx, invalid JSON, unsupported response, empty text.
- Never return bearer tokens, audio, raw provider bodies, exception strings/stacks, or arbitrary URLs.
- Preserve production transcribe shape while extending safely.

## Acceptance
Mock/local tests prove 200 JSON/verbose_json, 401, 500, timeout, refused connection, invalid JSON and empty text yield correct diagnostics and no secret leakage.

## Outcome
- REC/STOP/PLAY/TRANSCRIBE flow implemented with duration/bytes, permission/device/recorder-specific errors and cleanup.
- Sanitized SttDiagnostics propagated through adapter/service/IPC: serviceReached only after HTTP response, status/content type/JSON validity/stage/elapsed/endpoint/model/language/audio metadata.
- REC works without AI config; TRANSCRIBE requires provider. Electron permission checks restricted to trusted window/audio.
- Debug details panel under STT controls; footer message area used for operational notices.
- Focused unit (407), lint, typecheck, build, STT setup/editor/settings/onboarding/layout smokes and Linux package passed.
- Real device/provider still requires user verification; mocks are not claimed as real Unsloth proof.
