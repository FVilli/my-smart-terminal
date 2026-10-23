---
title: "M15 - Self-hosted AI and STT providers"
type: milestone
project: smart-terminal
created: 2026-10-23
id: "M15"
goal: "Configure and verify an OpenAI-compatible self-hosted chat endpoint and audio transcription endpoint, including Unsloth-style base URL, custom model, token and verbose_json."
depends_on: "M14"
---

# M15 - Self-hosted AI and STT providers

## Scope
AI base URL diagnostics, STT base URL/config/response format, wizard fields, mock-server tests, sanitized errors, guides. No streaming requirement.

## Acceptance
Mock self-hosted chat and transcription endpoints work with `/v1`, custom model names and tokens; STT accepts verbose_json; tokens stay in main; wizard/docs explain the fields and common failures.
