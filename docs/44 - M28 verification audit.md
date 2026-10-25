---
title: "M28 verification audit"
type: audit
project: smart-terminal
created: 2026-10-25
---
# M28 verification audit

Final audit for milestone M28 (settings clarity and AI surfaces polish). Range: v1.3.16 follow-up (`c79aaa4`) → M28 close; 26 files.

## Deliverables

| Task | Outcome |
| --- | --- |
| T01 | Settings/AI reads AI Provider → Base URL → Token → Model → Test AI. Visible providers are exactly OpenAI Compatible, Claude Platform and DeepSeek Platform (plus None); saved OpenAI/Anthropic values remain selectable only as legacy options. Settings/STT no longer offers Local command and its specific providers are DeepSeek Platform and OpenAI Compatible; an existing local configuration stays selectable as legacy. |
| T02 | Byte counters are right-aligned, muted and `text-[10px]`; BUILT-IN/CUSTOM counts align right inside the list container; the AI Actions header is inline like the assistant. The assistant uses an explicit grid: Answer spans from the AI action select row to the User prompt row, with the character/Send row below. Save, Reset this action and Delete plus Send use decorative icons and flex gaps. |
| T03 | AI/STT setup smokes assert the exact provider labels, the field order and the absence of the local entry; screenshots refreshed (13/13); docs 12/14/15/17/19 updated; this audit. |

## Verification matrix

| Gate | Result |
| --- | --- |
| `npm run lint`, `npx tsc -p tsconfig.json --noEmit` | pass |
| `npx vitest run` | 52 files, 489 tests pass |
| `npm run build` | pass |
| Documentation links / consistency / installation guides | pass |
| `npm run test:layout` | 4 OK (dark/light × 1440×900/1024×700) |
| Screenshots | 13/13 OK |
| AI setup smoke | field order, exact AI labels, Claude/DeepSeek presets, model refresh/persistence, token masking — `ok:true` |
| STT setup smoke | no local entry, exact STT labels, specific fields/preset/models, shared restore, recording/transcription — `ok:true` |
| AI smoke, settings smoke, STT smoke | `ok:true` |

## Behaviour and safety notes

- Provider trimming is a UI decision only: contracts still accept `openai`/`anthropic` so existing configurations load unchanged, and they appear as legacy options only while selected, allowing migration to Claude Platform or OpenAI Compatible.
- Local STT remains readable for existing configurations; new users cannot select it, and the command field is no longer rendered. No token or base-URL semantics changed.
- The assistant helper row (characters/Send) sits outside the Answer span, so the answer bottom aligns with the User prompt exactly while Send stays accessible below.
- Alignment/counters/headers/icons are presentation-only; test ids, aria labels, focus handling, prompt limits and no-submit semantics are unchanged.

## Independent review

Verdict: **OK with notes**, no findings. The reviewer verified field order and single token field, exact provider labels and legacy handling, STT local removal with safe legacy rendering, the Answer row span, decorative icons with preserved labels/test ids and doc consistency. Evidence limits: the reviewer inspected the supplied diff/source and did not rerun the gates.

## Manual / residual

- The zero-pixel alignment of Answer to select/User prompt and counter right-alignment should be confirmed visually at unusual zoom levels; automated checks cover the 1440×900 and 1024×700 layouts.
- Legacy providers/configurations are supported but intentionally not offered for new setups; a future release may migrate them automatically.
- These M28 changes ship in v1.3.17 (v1.3.16 was published before M28).
