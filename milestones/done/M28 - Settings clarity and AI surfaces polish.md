---
title: "M28 - Settings clarity and AI surfaces polish"
type: milestone
project: smart-terminal
created: 2026-10-25
id: "M28"
goal: "Streamline AI/STT settings (field order, provider lists, no local STT) and polish AI surfaces (counters, headers, alignment, icon buttons)."
depends_on: "M27"
---
# M28 - Settings clarity and AI surfaces polish

## Fixed decisions
- Settings/AI order: Provider, Base URL, Token, Model, Test AI.
- Visible AI providers: OpenAI Compatible, Claude Platform, DeepSeek Platform (plus None; legacy values shown only when saved so users can migrate).
- Settings/STT: no "Local command" entry; STT provider list limited to DeepSeek Platform and OpenAI Compatible (plus shared AI).
- Byte counters right-aligned, muted, smaller than labels; BUILT-IN/CUSTOM counts right-aligned in the list container; AI Actions header inline like the assistant; Answer aligned to the AI action select (top) and User prompt (bottom); Save/Reset/Delete and Send with icons and flex gaps.
- No behaviour, contract, security or test-id regressions.

## Acceptance
- Settings fields/order/lists match; no local STT; legacy configs still render safely.
- Visual polish at 1440×900/1024×700 and zoom; tests/smokes/docs/screenshots updated.

## Tasks
T01 settings ordering/lists → T02 visual polish → T03 verification.
