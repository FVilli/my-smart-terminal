---
title: "M15 - T01 - Self-hosted AI diagnostics"
type: task
project: smart-terminal
created: 2026-10-23
id: "M15-T01"
milestone: "M15"
depends_on: "M14"
deliverables: "Reliable OpenAI-compatible chat configuration, clear base URL/token/model guidance and sanitized errors"
---

# M15 - T01 - Self-hosted AI diagnostics

## Objective
Make the existing OpenAI-compatible chat path usable with Unsloth and diagnose failures.

## Constrained implementation
Keep `/chat/completions` composition but normalize trailing slashes; make explicit that the base URL must include `/v1`; support custom model names and token; improve Test AI errors with sanitized HTTP status/category, never token/body. Add a mock-server test for base URL/model/auth and a missing-token case. Investigate the reported failure against the mock; document likely causes.

## Acceptance
Mock chat works for `https://host/v1` + custom model + bearer token; test failure messages are actionable/sanitized; no secret leakage.

## Outcome
- AI Test now accepts the current unsaved wizard config and entered token (via `SetupTestAiRequest`), so testing before Save works.
- OpenAI-compatible base URL `/v1`, custom model names and token are supported; provider errors expose only sanitized HTTP status (e.g. HTTP 401), never token/body.
- Added unit coverage for unsaved values and sanitized 401/500; no secrets in results.
