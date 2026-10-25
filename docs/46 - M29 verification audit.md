---
title: "M29 verification audit"
type: audit
project: smart-terminal
created: 2026-10-25
---
# M29 verification audit

Final audit for milestone M29 (minimal design system and AI surface fixes). Range: v1.3.17 release baseline (`08c3214`) → M29 close; 31 files.

## Deliverables

| Task | Outcome |
| --- | --- |
| T01 | `styles.css` gains token-only `@layer components` primitives: `form-field`, `form-label`, `form-help`, `form-error`, `form-stack`, `field-counter`, `panel-header`, `panel-title`, `panel-footer`. `docs/45 - Design system.md` documents tokens, rhythm, the full primitive catalogue with Angular snippets, layout patterns, accessibility/testing, migration and governance/adoption. |
| T02 | AI Actions manager uses `panel-header`/`panel-footer`; both panes fill the modal height; the left list scrolls with a pinned counter row; the right editor grows a two-row template grid with right-aligned counters and icon action buttons. AI Assistant uses the form primitives for AI action and prompts, and the Answer pane (rendered Markdown or raw textarea) flex-fills the height. |
| T03 | Settings AI/STT labels, hints and errors use the primitives (ProviderFields included). The AI model select has no Custom entry: Provider default, discovered chat models, saved value only when absent. AI discovery excludes speech-to-text/audio ids; STT keeps transcription-workflow models or audio ids when no workflow metadata exists. Settings/STT no longer offers a new Local command entry. |

## Verification matrix

| Gate | Result |
| --- | --- |
| `npm run lint`, `npx tsc -p tsconfig.json --noEmit` | pass |
| `npx vitest run` | 52 files, 490 tests pass |
| `npm run build` | pass |
| Documentation links / consistency / installation guides | pass (216 links, 11 current docs) |
| `npm run test:layout` | 4 OK (dark/light × 1440×900/1024×700) |
| Screenshots | 13/13 OK, deterministic |
| AI smoke, AI setup smoke | `ok:true` |
| STT smoke, STT setup smoke | `ok:true` |
| Settings smoke | `ok:true` |

The verification worker measured viewport overflow (`scrollWidth === clientWidth`, `overflow:false`) at 1440×900 and 1024×700 for both AI scenarios. Exact Answer-to-select/User-prompt pixel alignment and template-editor height were not measured automatically and remain a visual/manual check.

## Review findings and fixes

The independent review initially returned **BLOCK** with one MAJOR and one MINOR:

| Severity | Finding | Resolution |
| --- | --- | --- |
| MAJOR | The visible "Model (optional)" label was a plain span and not programmatically associated with the select. | The span is now `<label class="form-label" for="ai-model-select">`, the select has the matching `id`, the redundant `aria-label` was removed, and the inner wrapper is a div (single association). Focused re-review: OK. |
| MINOR | The audio-id heuristic comment claimed it never matches chat models, while substring matching can. | The comment now states the false-positive risk; the model-list test covers chat ids (`gpt-4o`, `claude-sonnet`), a TTS id and STT ids, asserting only audio/transcription ids are filtered. Focused re-review: OK. |

## Behaviour and safety notes

- Design-system primitives consume existing semantic tokens/utilities only; no palette literals, inline styles, `!important` or new dependency.
- Model filtering is presentation/discovery only: provider defaults remain available, a saved model missing from discovery is still selectable (no silent data loss), and no contract/provider value was removed.
- The Local STT option is no longer offered; an existing local configuration still loads as a legacy selection. No token/base-URL semantics changed.
- Layout changes are presentation-only: test ids, aria labels, focus handling, prompt limits and no-submit semantics preserved.

## Manual / residual

- Confirm Answer alignment and the template-editor fill visually at zoom levels beyond the automated 1440×900/1024×700 set.
- The audio heuristic can filter a chat model whose id contains words like `audio`/`speech`; documented and covered by tests, but acceptable only as a heuristic.
- Adoption of the primitives is intentionally scoped to AI Assistant, AI Actions and Settings AI/STT; remaining legacy label classes elsewhere migrate incrementally under docs/45 governance.
- These M29 changes ship in v1.4.0 (v1.3.17 was published before M29).
