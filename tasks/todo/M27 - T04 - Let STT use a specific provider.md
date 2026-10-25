---
title: "M27 - T04 - Let STT use a specific provider"
type: task
project: smart-terminal
created: 2026-10-25
id: "M27-T04"
milestone: "M27"
depends_on: "M27-T03"
deliverables: "STT specific OpenAI-compatible provider with reused provider fields"
---
# M27 - T04 - Let STT use a specific provider

## Implementation
- Config: add optional `sttApiProvider` (`openai` | `deepseek` | `openai-compatible`), validated/persisted like other STT fields.
- Wizard STT: provider select with "Use the same AI provider", "Use Specific Provider (OpenAI-compatible)", "Local command"; specific mode shows the shared ProviderFields component (provider/base URL/token with stored hint), plus model select/refresh using the specific config/token; local mode shows the command field.
- Shared `ui/provider-fields.ts` component used by the AI tab and STT specific block (no duplicated markup), preserving test ids/aria.
- stt:models accepts optional `{config?, sttToken?}` so refresh works before saving; SttService uses provider/base URL/token resolution for shared and specific.
## Acceptance
- Specific provider saves/queries models/transcribes with its own base URL+token; shared and local paths unchanged; tests/smoke green.
