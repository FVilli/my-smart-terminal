---
title: "M09 - T03 - AI provider connection test"
type: task
project: smart-terminal
created: 2026-10-23
id: "M09-T03"
milestone: "M09"
depends_on: "T01"
deliverables: "AI provider connection test"
---
<!-- gsynchro:v1 id=b2b5f132-5480-4451-87ff-52df7a2569a9 registered=2026-10-23T12:22:28.375Z -->

# M09 - T03 - AI provider connection test

## Objective
Verify the configured AI provider responds before leaving setup.

## Constrained implementation
Add a shared `setup:test-ai` IPC contract and a “Test AI” action in the AI step. It sends a minimal, non-destructive request through the existing main-only AiService with the configured provider/base URL/model/token, timeout/abort, and returns a clear result (success, latency, model, sanitized error). Never execute commands, never log the token or prompt text beyond a fixed test marker. Support deterministic test mode for CI/smoke. Disable the action when unconfigured and show remediation links.

## Acceptance criteria
A configured provider shows a successful response; wrong token/URL/timeout/offline produce localized actionable errors; token never appears in UI or logs; no terminal command is executed; smoke test covers success/failure with test mode; unit tests cover timeout and sanitized errors.

## References
docs/05; docs/14; apps/desktop/src/main/ai-service.ts; packages/ai.

## Do not
Do not call providers from the renderer or persist the token outside the keychain.
