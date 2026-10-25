---
title: "M23 verification audit"
type: audit
project: smart-terminal
created: 2026-10-25
---
# M23 verification audit

Final audit for milestone M23 (AI prompt templates, custom actions and terminal context). Range: M22 closure (`c276bcf`) → M23 close; 50 files (mostly docs/screenshots); no dependency or lockfile change.

## Deliverables

| Task | Outcome |
| --- | --- |
| T01 | Action/template contracts, placeholder list and limits; `AiActionsStore` persists validated actions in `userData/config/ai-actions.json` (schema version, atomic 0600 writes, corrupt-file fallback with warning, built-in title/description fixed, reset/delete rules, 20-action cap). |
| T02 | `renderTemplate` (single pass, unknown literal, missing `unknown`/empty, 32 KiB cap), `composeAction` from stored definitions, `ai:compose` → `{ system, user }`, `ai:action` sends exactly the submitted prompts; secret gate on both; 15 s timeout. |
| T03 | `TerminalConsole` reads the active xterm buffer on demand (last 200 lines, 8 000 chars, ANSI/control stripped); panels register/unregister; compose includes `{{console}}`. |
| T04 | Modal uses a labelled `<select>` for built-in and custom actions and two editable prompts (`ai-system-prompt`, `ai-user-prompt`); select disables message-only actions on an empty draft; Use/Cancel/Close, focus, Escape and Detect again preserved. |
| T05 | AI actions settings tab: action list, template editor with byte counters and unknown-placeholder warnings, built-in Reset, custom Add/Delete, Save; pure logic helpers with tests; settings smoke exercises the full lifecycle. |
| T06 | `docs/36` (storage, placeholders, limits, security), updates to docs 05/11/12/13/15/19/24/34, capture scenario `ai-settings` and refreshed screenshots (10/10). |
| T07 | This audit and independent review. |

## Verification matrix

| Gate | Result |
| --- | --- |
| `npm run lint`, `npx tsc -p tsconfig.json --noEmit` | pass |
| `npx vitest run` | 46 files, 462 tests pass |
| `npm run build` | pass |
| Documentation links / consistency / installation guides | pass |
| `npm run test:layout` (1440×900, 1024×700) | ratio 0.75, no overflow, chrome metrics/token colors unchanged |
| Zoom 50/100/200 | ratio preserved, no overflow |
| Screenshot harness | 10/10 OK (`09-ai-actions` select + two prompts, `10-ai-settings` editor); deterministic apart from the known onboarding temp path |
| Electron smokes | AI (console marker, select, two prompts, Use/focus, Cancel/Close, sensitive block), settings (template save → modal, custom add → modal, reset/delete → modal), onboarding, STT, IPC, PTY, tabs, search, sidebar, clipboard, sync UI, AI/STT/remote setup — all `ok:true` |
| E2E / packaging | multi-instance e2e, `package:deb` and `test:deb` pass |

## Behaviour and security verified

- Placeholders render deterministically; a value containing `{{os}}` is not re-expanded; unknown placeholders remain literal; rendered prompts over 32 KiB are rejected rather than truncated.
- Both prompts are sent exactly as edited; the System prompt is user-owned (a deliberate change from M22's immutable instruction), while the modal keeps a visible note that nothing is executed and secrets are blocked.
- The secret filter runs in main on both prompts before test mode/network; provider failures expose only status/category; prompts and console text are never written to Markdown or logs.
- Template storage is local configuration (not synchronized). Built-in identity and titles cannot be changed by a client payload; duplicates, limits, invalid templates and corrupt files are handled (defaults + sanitized warning).
- Console context is bounded and read on demand; terminal input/focus and PTY semantics are unchanged.
- Settings changes apply to the modal on its next open; the editor validates before saving and surfaces API failures.

## Independent review

Initial verdict: **BLOCK** — one MAJOR finding: `AiActionsStore.commit()` updated the in-memory state before writing, so a failed persistence left the store serving unpersisted actions. Fixed by writing/renaming first and updating state only on success, plus a regression test that forces a write failure and asserts the previous state remains (`ai-actions-store.spec.ts`). Re-verification after the fix: lint, typecheck, 462 tests, build, AI/settings smokes and layout all green.

## Manual / residual

- Real cloud-provider behaviour, a physical microphone and a screen reader were not exercised automatically; their deterministic fixtures cover the logic paths.
- Terminal output included in `{{console}}` can contain sensitive data that the heuristic secret filter may not recognise; the modal sends it only on explicit Send, and templates are local, but this remains a user-facing privacy consideration.
- Template/custom-action export/import, syncing them across machines, per-action model selection and streaming remain out of M23 scope.
