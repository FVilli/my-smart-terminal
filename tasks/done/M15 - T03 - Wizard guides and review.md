---
title: "M15 - T03 - Wizard guides and review"
type: task
project: smart-terminal
created: 2026-10-23
id: "M15-T03"
milestone: "M15"
depends_on: "M15-T02"
deliverables: "AI/STT wizard fields, Unsloth examples, tests and security review"
---
<!-- gsynchro:v1 id=74a1c855-7de1-47ee-8693-b2eb3e33624c registered=2026-10-23T20:20:48.295Z -->

# M15 - T03 - Wizard guides and review

## Objective
Make self-hosted setup discoverable and verified.

## Constrained implementation
Add base URL/model/token fields for AI and STT (including response format/language), help text with the Unsloth-style example, test buttons, and sanitized status. Update docs/17, docs/19 and troubleshooting. Run mock-server tests, unit/lint/typecheck and independent security review of token/error handling. Do not claim the user's server was tested without a real key.

## Acceptance
Wizard can configure both endpoints; tests/docs agree; no secrets in logs/Markdown; review approved.

## Outcome
- Added AI/STT self-hosted fields and hints: AI provider label, `/v1` base URL example, custom model/token; STT base URL, response format (`json`/`verbose_json`), language, model/token.
- Test AI now tests current unsaved form values and entered token via `SetupTestAiRequest`; this removes the save-before-test trap.
- Updated docs/14 (settings tabs, Appearance/font, title/menu/zoom), docs/17 (self-hosted STT), docs/19 (Unsloth chat example/test semantics), with small pointers in docs/08/12.
- Unit tests, lint, typecheck, build, AI/STT setup smokes, settings/onboarding/editor/layout smokes and docs checks pass; independent review APPROVED.
- Residual risk: no real Unsloth server/key, OS microphone or packaged UI was tested; docs do not claim otherwise.
