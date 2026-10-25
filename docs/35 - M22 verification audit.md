---
title: "M22 verification audit"
type: audit
project: smart-terminal
created: 2026-10-25
---
# M22 verification audit

Final audit for milestone M22 (AI actions and session environment). Range: M21 closure (`dd231d2`) → M22 close; 74 changed files (mostly documentation and refreshed screenshots); no dependency or lockfile change.

## Deliverables

| Task | Outcome |
| --- | --- |
| T01 | `docs/34 - M22 AI actions design proposal.md`: five actions, modal anatomy, state machine, Cancel/Use/Close semantics, prompt/system split, environment fields and detection strategy. |
| T02 | `session.md` additive `os`/`shell`/`env_source`/`env_detected_at` (schema_version 1, no migration), local detection from the resolved shell, non-interactive SSH probe (`BatchMode`, `ConnectTimeout=3`, 5 s hard timeout, alias validated, `unknown` fallback), `terminal:environment` event and renderer update. |
| T03 | `ai:compose`/`ai:action` contracts with strict validation (exact keys, action ids, environment enums, 16 KiB), immutable system contracts in `packages/ai`, shared provider completion, sanitized results, 15 s timeout. |
| T04 | `AiActionsStore` + `AiActionsModal`: five actions, session/provider header, editable prompt with context and Ctrl/Cmd+Enter, read-only selectable answer, focus trap/Escape/focus return, Cancel/Use/Close, unconfigured warning; composer AI button now opens the modal. |
| T05 | Shared `insertAtSelection` helper; `Use` inserts selection or full answer at the caret, restores focus and never submits; STT keeps its padding behaviour. |
| T06 | Secret filter blocks the provider call before any network (and before test mode); injection-safe system/body split; structured `sensitive`/`timeout`/`provider-error`/`empty`/`unconfigured` outcomes; late answers discarded; advisory risk notice. |
| T07 | Docs 05/11/12/13/14/15/19/24/28/34 updated; capture scenario `ai-actions`; refreshed screenshot set (`09-ai-actions.png`, updated `04-ai-review.png`). |
| T08 | This audit plus independent review. |

## Verification matrix

| Gate | Result |
| --- | --- |
| `npm run lint`, `npx tsc -p tsconfig.json --noEmit` | pass |
| `npx vitest run` | 42 files, 445 tests pass |
| `npm run build` | pass |
| Documentation links / consistency / installation guides | pass |
| `npm run test:layout` (1440×900, 1024×700) | ratio 0.75, no overflow, header 35, tabs 38, composer 137, footer 28, token colors unchanged |
| Zoom 50/100/200 (throw-away profile) | ratio preserved, no overflow |
| Screenshot harness | 9/9 scenarios OK, including `ai-actions` and the updated `ai-review` (modal answer) |
| Electron smokes | 14/14 `ok:true`: IPC, PTY, tabs, search, sidebar, clipboard, settings, onboarding, AI actions, STT, sync UI, AI setup, STT setup, remote setup |
| `scripts/e2e-multi-instance.mjs` | primary takeover and cross-machine marker OK |
| `npm run package:deb` + `test:deb` | OK |

## Behaviour verified

- **Local environment** is recorded at session creation and persisted: a smoke session produced `os: linux`, `shell: bash`, `env_source: local` in `session.md`. Older sessions without the fields still load and sync.
- **SSH environment** starts as `unknown` and is filled by a probe that runs outside the interactive PTY with stdio `ignore/pipe/ignore`; failures are silent and never block the session. The modal's **Detect again** re-runs the same validated probe (local returns immediately) and persists/publishes the result.
- **Modal flow** (AI smoke): open → session/provider context → five actions → editable prompt containing `<user_body>` → deterministic test-mode answer → `Use` inserts the answer at the caret, keeps focus and does not submit → `Cancel`/`Close` leave the draft untouched. A prompt containing a secret is blocked with the modal message and the draft is unchanged.
- **No execution surface**: the AI never calls the PTY, never submits the composer and never writes prompt/answer to Markdown, history or logs (`grep` over the AI paths shows no content logging or file writes).
- **Security**: system instructions are fixed in `packages/ai` and unit tests assert the request body keeps them separate from the edited prompt; provider failures expose only `HTTP <status>` or a generic category; the secret gate runs in main before test-mode and network.

## Independent review

Verdict: **acceptable with fixes**. One MINOR finding: `docs/34` promised a **Detect again** control that was not implemented. Fixed by adding:

- contract `terminal:detect-environment` (`{ sessionId }` → `SessionEnvironment`) with exact-key validation;
- `TerminalHost.detectEnvironment` reusing the same probe, persisting through `DataRuntime.updateSessionEnvironment` and publishing `terminal:environment`; local sessions resolve immediately;
- `AiActionsStore.detectEnvironment` plus a **Detect again** button shown for SSH sessions (disabled while detecting);
- IPC validation tests and renderer store test; docs/11/12/34 updated.

Re-review state after the fix: lint, typecheck, 445 tests, build, AI smoke and layout all green.

## Manual / residual

- Real cloud provider latency, real SSH hosts (including Windows remote shells) and a screen reader were not exercised here; their deterministic fixtures are covered by unit tests and the test-mode smoke.
- Streaming answers, AI conversation history, a shell-command guard for `fix-message` and richer remote environment detection are out of M22 scope and remain candidates for a follow-up milestone.
- Refreshed screenshots are captured from the harness; the onboarding scenario keeps its known nondeterministic temporary path.
