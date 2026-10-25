---
title: "M27 verification audit"
type: audit
project: smart-terminal
created: 2026-10-25
---
# M27 verification audit

Final audit for milestone M27 (AI layout, clipboard placeholder, provider presets and STT provider choice). Range: v1.3.15 release baseline (`a58213b`) → M27 close; 32 files.

## Deliverables

| Task | Outcome |
| --- | --- |
| T01 | System and User prompts split the left pane height 50/50, the Markdown answer fills the right pane, the Answer label and Rendered/Raw toggles share one row, and the last used action is persisted best-effort and preselected (per-session kept prompts still win). |
| T02 | `{{clipboard}}` is resolved in the main process at compose time (string or promise), NUL/CR stripped, capped at 16 000 characters with a truncation marker, never logged or persisted; failures degrade to empty. |
| T03 | Claude Platform and DeepSeek Platform presets fill base URLs automatically; `ai:models` lists provider models (Anthropic headers or OpenAI bearer, entered token wins); Settings/AI offers Provider default, discovered models and a Custom fallback with refresh. |
| T04 | Settings/STT offers same-AI, specific OpenAI-compatible (provider, base URL, keychain token), local command and none; `stt_api_provider` persists; model refresh accepts the unsaved config/token; models/status/transcription resolve shared or specific base URLs and tokens through a reusable `ProviderFields` component. |
| T05 | Tests, smokes, screenshots and docs 12/14/15/17/19/36 updated; this audit. |

## Verification matrix

| Gate | Result |
| --- | --- |
| `npm run lint`, `npx tsc -p tsconfig.json --noEmit` | pass |
| `npx vitest run` | 52 files, 489 tests pass |
| `npm run build` | pass |
| Documentation links / consistency / installation guides | pass |
| `npm run test:layout` | 4 OK (dark/light × 1440×900/1024×700) |
| Screenshots | 13/13 OK |
| AI smoke | sparkle trigger, clipboard-safe prompts, rendered/raw, Use, no auto-send, sensitive block — `ok:true` |
| AI setup smoke | DeepSeek preset URL, model refresh/selection/persistence, token masking — `ok:true` |
| STT setup smoke | shared/specific fields, DeepSeek preset, specific model refresh, restore shared, recording/transcription — `ok:true` |
| STT smoke, settings smoke | `ok:true` |

## Behaviour and safety notes

- Clipboard content is read in main only when composing prompts; it is capped, never persisted and never returned separately. Because it becomes part of the rendered prompts, the existing sensitive-text gate can block an action when the clipboard contains secrets (documented).
- Model discovery uses the entered token only for the explicit refresh/test path, otherwise the keychain token; errors expose status codes only, never bodies or headers. A saved custom model survives refresh via the Custom option.
- STT specific mode stores its token under `stt:cloud` and never reads the AI token; shared mode keeps using the AI provider token and still requires an OpenAI-compatible AI provider. Local and none paths are unchanged.
- Provider presets only fill the base URL on selection; self-hosted/custom URLs remain editable.
- Layout is pure presentation: no PTY/IPC change, prompt limits and no-submit semantics preserved.

## Independent review

Verdict: **OK with notes**, no findings. The reviewer checked guarded clipboard reads, sensitive gating, best-effort last-action storage, provider-specific model discovery, STT specific token/base resolution and doc accuracy. Evidence limits: the reviewer inspected the supplied diff/source and did not rerun the gates.

## Manual / residual

- Real clipboard behaviour across OSes (text formats, very large content) and real provider model lists (Claude/DeepSeek/OpenAI) remain manual; model endpoints can legitimately return an empty list, in which case the UI keeps the custom/default value.
- Specific-provider STT transcription against a real OpenAI-compatible server and the exact DeepSeek audio support are environment-dependent: DeepSeek's chat models are not transcription models, so users must point STT at an audio-capable endpoint.
- Rendered-selection `Use`, screen-reader navigation and zoom checks beyond the automated set remain manual.
- These M27 changes ship in v1.3.16 (v1.3.15 was published before M27).
