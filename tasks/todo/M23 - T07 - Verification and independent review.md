---
title: "M23 - T07 - Verification and independent review"
type: task
project: smart-terminal
created: 2026-10-25
id: "M23-T07"
milestone: "M23"
depends_on: "M23-T06"
deliverables: "Evidence-backed verification of templates, custom actions, console context and non-regression"
---

# M23 - T07 - Verification and independent review

## Implementation
- Full gates: lint, typecheck, tests, build, docs, layout/zoom, screenshots, smokes (AI/settings/onboarding/STT/sync/IPC/PTY), packaging when available.
- Verify: preset/custom action compose, placeholder rendering, edited prompts sent verbatim, console text bounded and never persisted/logged, secret gate, corrupt config fallback, settings save/reset/delete, focus/accessibility.
- Independent review of the M23 diff against docs/29-31 and M20 visuals; record verdict, fixes and residual debt in `docs/37 - M23 verification audit.md`.
- Manual/blocked checks (real provider, screen reader) documented.

## Acceptance
- All required gates green or explicitly blocked; review recorded; all M23 tasks done before closing.
