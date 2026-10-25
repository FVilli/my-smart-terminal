---
title: "M27 - AI layout, clipboard, provider presets and STT provider choice"
type: milestone
project: smart-terminal
created: 2026-10-25
id: "M27"
goal: "Use the AI Assistant space fully, add the {{clipboard}} placeholder, preselect the last action, discover models for AI settings, add DeepSeek/Claude provider presets, and let STT use a specific OpenAI-compatible provider."
depends_on: "M26"
---
# M27 - AI layout, clipboard, provider presets and STT provider choice

## Fixed decisions
- Assistant left pane: System/User prompt textareas split the available height 50/50; the right pane Answer fills the full height; the Answer label sits left with Rendered/Raw right-aligned on the same row.
- The last used action is persisted locally (non-sensitive) and preselects on open; per-session kept prompts still win over it.
- `{{clipboard}}` is resolved in the main process at compose time from the system clipboard, capped/truncated, never persisted; the existing secret gate still blocks sensitive rendered prompts.
- AI model stays optional and becomes a select with a refresh that lists provider models (custom values preserved via a Custom option). Presets: Claude Platform and DeepSeek Platform fill the base URL automatically.
- STT gets "Use Specific Provider (OpenAI-compatible)" with provider, base URL, token and model refresh, reusing shared provider-field markup; AI tab and STT-specific block share one component.
- Tokens never cross IPC except the existing explicit "test/refresh with entered token" path; no new dependency; M20 tokens and test ids preserved.

## Acceptance
- Assistant panes use the full height, the answer toolbar is on one row, and reopening the modal selects the last action.
- `{{clipboard}}` renders, is listed in the placeholder help, is truncated safely and is exercised by tests.
- AI settings list models with refresh and a provider default/custom model; DeepSeek/Claude presets set URLs automatically.
- STT can use the same AI provider or a specific OpenAI-compatible provider with its own URL/token; models load for both.
- Tests, smokes, docs and screenshots updated; no new dependency.

## Tasks
T01 layout + last action → T02 {{clipboard}} → T03 AI models/presets → T04 STT specific provider → T05 verification.
