---
title: "M25 verification audit"
type: audit
project: smart-terminal
created: 2026-10-25
---
# M25 verification audit

Final audit for milestone M25 (AI Actions modal, header icons, settings layout fixes). Range: M24 close (`88ed75e`) → M25 close; 44 files. The range also contains the v1.3.13 release bump and two post-release theme/CI fixes; M25 changes are those after the release commit.

## Deliverables

| Task | Outcome |
| --- | --- |
| T01 | Settings dialog `min(640px, 92vw)` × `min(744px, 90vh)` (20% taller, narrower); four tabs (Repository/AI/STT/Appearance); AI Actions tab/case/import removed; smoke and capture assert the new geometry and tab set. |
| T02 | Editor list footer keeps only the top border, the `+` button and a tiny `BUILT-IN:<n> CUSTOM:<n>` counter; bulk Reset removed; custom actions require an inline delete confirmation; built-ins keep per-action reset and cannot be deleted. |
| T03 | Dedicated AI Actions modal (`ai-actions-manager.ts`) wrapping the existing editor at `min(1000px, 94vw)` × `min(720px, 90vh)`, opened from the new header wand; header order is wand / settings wrench / layout toggle, window controls unchanged; focus trap, Escape, backdrop and focus return (now driven by the open transition, so any store close restores focus). |
| T04 | AI smoke covers manager open, counter, add/save custom action, delete cancel/confirm, focus return and settings-without-editor; capture scenario `ai-manager` + `12-ai-actions-manager.png`; docs 12/15/28/36/40 updated; screenshots refreshed. |

## Verification matrix

| Gate | Result |
| --- | --- |
| `npm run lint`, `npx tsc -p tsconfig.json --noEmit` | pass |
| `npx vitest run` | 49 files, 473 tests pass |
| `npm run build` | pass |
| Documentation links / consistency / installation guides | pass |
| `npm run test:layout` | 4 OK (dark/light × 1440×900/1024×700), dark metrics unchanged |
| Screenshot harness | 12/12 OK, including `12-ai-actions-manager.png`; only the known onboarding temp path and 4 px of light-theme antialias differ across runs |
| Electron smokes | AI (manager flow) and settings (`settingsWide`, `settingsTall`, four tabs) `ok:true` |

## Behaviour notes

- Settings no longer contains the AI Actions editor; the editor only exists inside the dedicated modal. The composer AI assistant modal remains a separate surface.
- The header keeps stable ids (`ai-actions-open`, `settings-open`, `header-panel-toggle`) and accessible names; the Settings glyph is now a wrench and the AI Actions glyph a magic wand, both `currentColor` SVGs.
- The footer counter is derived from the stored action list; there is no bulk reset, and deleting a custom action always requires confirmation. Error messages stay sanitized.
- The focal return is tied to the open→closed transition rather than one close handler, covering programmatic store closes.

## Independent review

Verdict: **OK with notes**. One MINOR finding: focus return only happened in the component close handler, so a store-driven close would skip it. Fixed by observing the open transition in the component and returning focus to `ai-actions-open` on any close; re-verified with lint, typecheck, 473 tests, build and the AI smoke.

## Residual/manual

- Real browser opening and screen-reader checks from M24 remain manual and are unaffected by M25.
- These M25 UI changes ship in v1.3.14 (v1.3.13 was published before M25).
- Deferred appearance options (OS-following theme, accents, sizes, density, transparency) remain out of scope.
