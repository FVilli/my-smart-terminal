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
