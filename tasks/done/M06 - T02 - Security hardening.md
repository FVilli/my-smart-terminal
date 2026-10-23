---
title: "M06 - T02 - Security hardening"
type: task
project: smart-terminal
created: 2026-10-22
id: "M06-T02"
milestone: "M06"
depends_on: "T01"
deliverables: "Security hardening"
---
<!-- gsynchro:v1 id=505f3660-7dd4-4284-a672-caec66549277 registered=2026-10-23T07:58:11.585Z -->

# M06 - T02 - Security hardening

## Objective
Security hardening.

## Constrained implementation
Audit IPC, path traversal, secret filtering, keychain, and logs.

## Acceptance criteria
Negative tests and a checklist report with no secrets in files.

## References
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce databases, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: exact origin for navigation, protocol handler against traversal/null/invalid URIs, symlink rejection in session and allocator paths, long socket-path fallback, Git remote validation, per-channel payload limits, and audit of risky logs/APIs.
- Verification: 385 tests (navigation hardening, path safety, long endpoint, Git remote, negative IPC); lint/typecheck/build passed.
- Report: `docs/13 - Security checklist.md` with residual risks (heuristic filters, named-pipe ACLs, Git hooks, keyring, signing, no auto-update).
