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

# M15 - T03 - Wizard guides and review

## Objective
Make self-hosted setup discoverable and verified.

## Constrained implementation
Add base URL/model/token fields for AI and STT (including response format/language), help text with the Unsloth-style example, test buttons, and sanitized status. Update docs/17, docs/19 and troubleshooting. Run mock-server tests, unit/lint/typecheck and independent security review of token/error handling. Do not claim the user's server was tested without a real key.

## Acceptance
Wizard can configure both endpoints; tests/docs agree; no secrets in logs/Markdown; review approved.
