---
title: "M22 - T03 - Add AI action contracts and main-process service"
type: task
project: smart-terminal
created: 2026-10-25
id: "M22-T03"
milestone: "M22"
depends_on: "M22-T01"
deliverables: "Typed ai:compose/ai:action IPC, prompt builders per action in packages/ai, main service with validation and sanitized results"
---

# M22 - T03 - Add AI action contracts and main-process service

## Objective
Provide the five actions through one typed, validated, main-process AI path that owns prompt templates and provider calls.

## Implementation
- Contracts (`packages/contracts/src/index.ts`): `AiActionId` (`suggest-command | explain-command | assess-risk | fix-message | rewrite-dictated`), `AiEnvironment` (`{ os, shell, source }`), `AiComposeRequest` (`{ action, input, environment? }`), `AiComposeResult` (`{ prompt }`), `AiActionRequest` (`{ action, prompt }`), `AiActionResult` (`{ text, skipped, reason?, error?, elapsedMs }`). Add `IPC_CHANNELS.aiCompose` / `aiAction` and the matching `SmartTerminalApi` methods.
- `packages/ai`: one module with the fixed system instruction and editable body template per action, a shared context block (`os`, `shell`) and the existing correction prompt reused by `fix-message`/`rewrite-dictated`. User text is delimited and inserted as data; the system instruction cannot be overridden by the editable body. Unit tests assert templates, delimiters and that the correction action keeps preserving commands/paths.
- `apps/desktop/src/main/ai-service.ts`: `compose(request)` validates and renders the prefilled prompt; `action(request)` validates action id and prompt size (≤16 KiB), rejects unknown fields, builds the provider payload, calls the existing adapters (15 s timeout, temperature 0), returns sanitized diagnostics and never throws provider bodies. `unconfigured`/`missing-token` are structured skips like the existing correction path.
- `apps/desktop/src/main/ipc.ts`: two channels with strict validators, `AiGateway` extended, channel map updates; keep the existing `ai:correct` behaviour for compatibility and share the prompt builder.
- Tests: ipc validation (`ipc.spec.ts`), service behaviour with a mocked fetch/provider (`ai-service.spec.ts`), package template tests, and a test-mode path (`SMART_TERMINAL_AI_TEST_MODE`) that returns deterministic text for smokes.

## Acceptance
- Both channels work with exact validation and sanitized failures; no token or raw provider response reaches the renderer.
- The five action templates exist once in `packages/ai`; `fix-message` reuses the existing correction instructions.
- Unit tests, typecheck, lint and build pass; no new dependency.
