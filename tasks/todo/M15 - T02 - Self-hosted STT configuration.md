---
title: "M15 - T02 - Self-hosted STT configuration"
type: task
project: smart-terminal
created: 2026-10-23
id: "M15-T02"
milestone: "M15"
depends_on: "M15-T01"
deliverables: "stt_base_url, response format and language support for OpenAI-compatible transcription"
---

# M15 - T02 - Self-hosted STT configuration

## Objective
Allow the Unsloth audio endpoint (base `/v1`, custom Parakeet model, verbose_json, language) to work.

## Constrained implementation
Add optional `sttBaseUrl`, `sttResponseFormat` (`json`/`verbose_json`) and `sttLanguage` to config/contracts/IPC, with validation and backwards-compatible defaults. Compose `<base>/audio/transcriptions`, normalize slashes, send multipart file/model/language/response_format, parse `text` from both response shapes. Add mock-server tests for verbose_json and errors. No audio persisted.

## Acceptance
Mock transcription works with the provided base/model/format; old configs load unchanged; token/audio handled safely.
