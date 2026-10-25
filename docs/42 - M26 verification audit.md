---
title: "M26 verification audit"
type: audit
project: smart-terminal
created: 2026-10-25
---
# M26 verification audit

Final audit for milestone M26 (AI surfaces polish). Range: M25 close (`5742e4a`) → M26 close; 39 files including the v1.3.14 release bump.

## Deliverables

| Task | Outcome |
| --- | --- |
| T01 | Composer AI trigger shows only the sparkles glyph (28 px, centered), keeps `data-testid="ai-correction"`, aria-label "AI actions", busy state and the open/insert flow. |
| T02 | AI Actions manager is explicitly 792 px tall (10% over 720) with a 90 vh cap, unchanged 1000 px width, scrolling body and pinned footer. |
| T03 | AI Assistant modal is 90 vw × 90 vh with a compact single-row header (title, session/provider, detect/warning) and a 50/50 body: left select + System/User prompts + Send/counters, right answer. Footer spans; all behaviour/test ids preserved. |
| T04 | Dependency-free `renderMarkdown` (escaped source, fences, inline code, headings, emphasis, lists, quotes, rules, http(s)-only links), `MarkdownView` with Rendered/Raw toggle and Rendered/Raw selection capture; `Use` works in both views and never submits. |
| T05 | Smokes/captures/docs updated (`13-ai-answer.png`), AI smoke covers rendered/raw/full-answer Use, docs 12/15/24/28/36 updated, this audit. |

## Verification matrix

| Gate | Result |
| --- | --- |
| `npm run lint`, `npx tsc -p tsconfig.json --noEmit` | pass |
| `npx vitest run` | 50 files, 478 tests pass |
| `npm run build` | pass |
| Documentation links / consistency / installation guides | pass |
| `npm run test:layout` | 4 OK (dark/light × both viewports) |
| Zoom 50/100/200 | preserved ratios, no overflow |
| Screenshots | 13/13 OK; existing set refreshed; `13-ai-answer.png` shows the rendered answer; known nondeterminism limited to the onboarding temp path and small antialias differences |
| AI smoke | sparkle trigger, manager counter/add/delete/focus, assistant rendered answer, raw toggle, full-answer Use, no auto-send, sensitive block — `ok:true` |
| Settings smoke | `ok:true` (unchanged settings flow) |

Measured modal surfaces at 1440×900: assistant 1292×806 px (≈90 vw × 90 vh), manager 996×788 px (792 height cap), settings 636×740 px.

## Behaviour and safety notes

- Markdown rendering escapes all source HTML first and only emits fixed markup; links must be `http(s)` and receive `target="_blank" rel="noreferrer noopener"`; unsafe schemes render as text. No new dependency and no CSP change.
- The raw textarea remains in the DOM in rendered mode (hidden), so existing smoke/automation and copy workflows can read the exact answer; rendered selection is only accepted when fully inside the answer container.
- `Use` inserts the current selection or the whole answer at the caret and never submits; prompt limits, secret gate, timeouts and error/sensitive states are unchanged.
- Assistant header is compact; large sizes are pure layout (90% of the window) with internal pane scrolling; no PTY or IPC behaviour changed.

## Independent review

Verdict: **OK with notes**, no findings. The reviewer independently verified escaping/link rules, the signal-driven toggle, contained selection capture, 90/90 sizing with scrolling panes, the manager's explicit 792 px height, the sparkle trigger and unchanged guards. Evidence limits: the reviewer inspected the supplied diff/source and did not re-run commands or the rendered-selection interaction.

## Manual / residual

- Rendered-selection `Use` is exercised by design and unit-level selection logic, but the automated smoke uses the raw/full-answer path; a real pointer selection in the rendered pane remains a manual check.
- Real provider behaviour and screen-reader navigation remain manual, as in M24.
- The answer renderer intentionally supports a conservative Markdown subset (no tables, images or raw HTML); extending it is a separate decision.
- These M26 UI changes ship in v1.3.15 (v1.3.14 was published before M26).
