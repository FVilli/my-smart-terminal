---
title: "M27 - T03 - Discover AI models and add provider presets"
type: task
project: smart-terminal
created: 2026-10-25
id: "M27-T03"
milestone: "M27"
depends_on: "M27-T02"
deliverables: "AI model discovery IPC, model select with refresh, Claude/DeepSeek presets"
---
# M27 - T03 - Discover AI models and add provider presets

## Implementation
- Contracts/providers: add `claude` and `deepseek` (protocols anthropic/openai), shared labels/default base URLs (`https://api.anthropic.com`, `https://api.deepseek.com/v1`); endpoint resolution understands the new ids.
- packages/ai: `listAiModels({provider, baseUrl?, token, fetch?})` -> `/v1/models` (anthropic headers) or `/models`; returns `{id}` sorted.
- IPC `ai:models` with optional `{config?, aiToken?}` (entered token wins, else stored); AiService test mode returns fixtures; preload/API types.
- Wizard AI tab: provider labels; selecting Claude/DeepSeek/OpenAI auto-fills the preset URL; Model becomes a select (Provider default, discovered models, Custom + text) with a refresh button `onboarding-ai-refresh-models`; errors/loading hints; token unchanged.
- Smoke updated to cover presets and model refresh in test mode.
## Acceptance
- Model select + refresh works, custom model still possible, presets fill URLs, existing test ids/validation/save green.
