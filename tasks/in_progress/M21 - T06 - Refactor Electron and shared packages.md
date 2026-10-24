---
title: "M21 - T06 - Refactor Electron and shared packages"
type: task
project: smart-terminal
created: 2026-10-24
id: "M21-T06"
milestone: "M21"
depends_on: "M21-T05"
deliverables: "Clean main/preload/services/contracts implementations and regression tests"
---
<!-- gsynchro:v1 id=11cb0bd2-3956-4c41-88fd-8bdf1bf813ca registered=2026-10-24T22:31:29.289Z -->

# M21 - T06 - Refactor Electron and shared packages

## Objective
Improve clarity and cohesion in Electron and supporting packages while retaining runtime and security behavior.

## Implementation
- Cover main/preload IPC, shared contracts, PTY/session, Markdown data, Git/sync coordinator and AI/STT adapters in bounded passes.
- Consolidate redundant helpers only when identical in semantics; simplify branching and error handling, avoid hiding security-sensitive operations.
- Preserve IPC validation, contextIsolation, permissions, safeStorage, token redaction, endpoint logging policy and process cleanup.
- Preserve ordering, timeouts, cancel behavior, retries, serialization, error shape and wire contracts.
- Add comments for invariants around main/renderer trust boundaries, leader election, Git serialization, resources and provider diagnostics.
- Add tests capturing semantics before deleting or merging complex code.

## Acceptance
No changed public/IPC/data contracts or runtime semantics; relevant tests and security checks pass; no unapproved dependencies.
