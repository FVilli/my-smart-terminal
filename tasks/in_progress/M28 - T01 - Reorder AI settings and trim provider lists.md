---
title: "M28 - T01 - Reorder AI settings and trim provider lists"
type: task
project: smart-terminal
created: 2026-10-25
id: "M28-T01"
milestone: "M28"
depends_on: "M27"
deliverables: "AI order Provider/URL/Token/Model/Test, three provider choices, no local STT"
---
# M28 - T01 - Reorder AI settings and trim provider lists

## Implementation
- Move the token block before Model; keep test AI last.
- AI provider options: OpenAI Compatible, Claude Platform, DeepSeek Platform (+ None); legacy openai/anthropic only as current-value options.
- STT: remove Local command entry and its fields; STT specific providers only DeepSeek Platform and OpenAI Compatible; legacy local stays selectable only when already saved.
## Acceptance
- Order/lists exact; presets still fill URLs; validation/save unchanged; tests green.
