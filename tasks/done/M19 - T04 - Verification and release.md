---
title: "M19 - T04 - Verification and release"
type: task
project: smart-terminal
created: 2026-10-25
id: "M19-T04"
milestone: "M19"
depends_on: "M19-T03"
deliverables: "Focused Linux tests, docs/security updates, packaged build and release verification"
---
<!-- gsynchro:v1 id=4893dac9-a77e-4be8-9ac4-fde1daede5c1 registered=2026-10-24T17:17:12.610Z -->

# M19 - T04 - Verification and release

## Objective
Validate the STT diagnostics without overclaiming real-device/provider behavior.

## Constrained implementation
- Run focused unit/IPC/smoke tests, Linux build/package verification.
- Update docs/17 and security/IPC docs with debug fields/caveats.
- Release Linux-only if requested by the rapid-phase policy; state that real microphone/provider still requires user verification.
- Do not mark real-device/provider acceptance complete from mocks.

## Acceptance
Tests and package pass; docs match; sanitized diagnostics verified; release assets/checksums verified.

## Outcome
- REC/STOP/PLAY/TRANSCRIBE flow implemented with duration/bytes, permission/device/recorder-specific errors and cleanup.
- Sanitized SttDiagnostics propagated through adapter/service/IPC: serviceReached only after HTTP response, status/content type/JSON validity/stage/elapsed/endpoint/model/language/audio metadata.
- REC works without AI config; TRANSCRIBE requires provider. Electron permission checks restricted to trusted window/audio.
- Debug details panel under STT controls; footer message area used for operational notices.
- Focused unit (407), lint, typecheck, build, STT setup/editor/settings/onboarding/layout smokes and Linux package passed.
- Real device/provider still requires user verification; mocks are not claimed as real Unsloth proof.
