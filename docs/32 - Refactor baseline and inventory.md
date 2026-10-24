---
title: "Refactor baseline and inventory"
type: audit
project: smart-terminal
created: 2026-10-24
---
# Refactor baseline and inventory

Planning evidence for M21. Governance: [coding rules](29%20-%20Coding%20rules.md), [Angular conventions](30%20-%20Angular%20conventions.md), [comments and documentation policy](31%20-%20Comments%20and%20documentation%20policy.md). Measurements below were taken on the M20 closure commit (`63f3db1`) with the repository at version 1.3.12. Line references are navigational; a large file is not automatically a problem.

## Baseline

| Check | Result | Run |
| --- | --- | --- |
| `npm run lint` (with the new type-aware rules) | 0 problems, 2.9 s | M21-T04 |
| `npx tsc -p tsconfig.json --noEmit` | pass | M21-T04 |
| `npx vitest run` | 38 files, 408 tests pass | M21-T04 |
| `npm run build` (production renderer + desktop) | pass, initial bundle 598.39 kB | M21-T04 |
| `npm run test:doc-consistency`, `npm run test:docs-links` | pass (11 documents, 151 Markdown files) | M21-T04 |
| Layout at 1440×900 and 1024×700 | ratio 0.75, no overflow, header 35, tabs 38, composer 137, footer 28, exact token colors | provided by M20 |
| Zoom 50 % / 100 % / 200 % | ratio preserved, no overflow (±1 px rounding at 50 %) | provided by M20 |
| Screenshot harness | 8/8 scenarios OK | provided by M20 |
| Electron smokes (IPC, tabs, search, clipboard, sidebar, settings, onboarding, AI setup, STT setup, remote setup) | 10/10 `ok:true` | provided by M20 |
| Linux packaging | `npm run package:deb` + `npm run test:deb` pass | provided by M20 |

## Static inventory

Method: TypeScript compiler AST over `git ls-files '*.ts'` (function-like nodes: declarations, methods, constructors, arrow functions; nested arrows are counted separately, so spec callbacks appear as `<arrow>`), `wc -l` for files, targeted regex counts for style/robustness markers. Counts are baselines, not targets.

### Largest files (tracked source)

| Lines | File |
| ---: | --- |
| 1253 | `apps/desktop/src/main/smoke.ts` |
| 879 | `apps/renderer/src/app/onboarding/onboarding-wizard.ts` |
| 613 | `apps/desktop/src/main/ipc.ts` |
| 507 | `packages/sync/src/git/git-engine.ts` |
| 502 | `packages/data/src/schema.ts` |
| 477 | `packages/contracts/src/index.ts` |
| 464 | `packages/sync/src/git/git-engine.spec.ts` |
| 409 | `apps/desktop/src/main/main.ts` |
| 401 | `packages/sync/src/coordinator.spec.ts` |
| 385 | `apps/renderer/src/app/stt/stt-store.ts` |
| 381 | `apps/desktop/src/main/coordinator-runtime.ts` |
| 361 | `packages/data/src/session-id.ts` |
| 336 | `apps/desktop/src/main/ipc.spec.ts` |
| 303 | `apps/desktop/src/main/onboarding-service.ts` |
| 293 | `packages/ai/src/stt.ts` |
| 292 | `packages/sync/src/protocol.ts` |
| 289 | `apps/desktop/src/main/app-config.ts` |
| 276 | `packages/data/src/search-index.ts` |
| 241 | `apps/desktop/src/main/coordinator-runtime.spec.ts` |
| 237 | `packages/terminal/src/session-manager.ts` |

### Longest functions/methods

| Lines | Location | Symbol |
| ---: | --- | --- |
| 163 | `apps/desktop/src/main/main.ts:232-394` | app bootstrap handler |
| 147 | `apps/desktop/src/main/ipc.ts:384-530` | `createChannelMap` |
| 135 | `apps/desktop/src/main/main.ts:96-230` | `createWindow` |
| 120 | `apps/desktop/src/main/capture.ts:48-167` | `runCapture` |
| 96 | `packages/ai/src/stt.ts:198-293` | `transcribeAudio` |
| 79 | `apps/desktop/src/main/onboarding-service.ts:207-285` | `save` |
| 77 | `apps/renderer/src/app/onboarding/onboarding-wizard.ts:543-619` | `startSttRecording` |
| 85 | `apps/desktop/src/main/app-config.spec.ts:37-121` | spec `<arrow>` (test fixture) |
| 78 | `packages/sync/src/git/git-engine.spec.ts:371-448` | spec `<arrow>` (test fixture) |

The seven production rows above are the ones over 70 lines; the raw ranking is otherwise dominated by spec callbacks (`git-engine.spec.ts` 202 lines, renderer store specs 175/178) that are test fixtures and lower priority.

### Classes over 250 lines

| Lines | Class |
| ---: | --- |
| 842 | `OnboardingWizard` (`apps/renderer/src/app/onboarding/onboarding-wizard.ts`) |
| 450 | `GitEngine` (`packages/sync/src/git/git-engine.ts`) |
| 263 | `FileSessionIdAllocator` (`packages/data/src/session-id.ts`) |
| 262 | `CoordinatorRuntime` (`apps/desktop/src/main/coordinator-runtime.ts`) |
| 260 | `SttStore` (`apps/renderer/src/app/stt/stt-store.ts`) |

### Markers and counts

| Marker | Count | Notes |
| --- | ---: | --- |
| `any` | 0 | ESLint `no-explicit-any` already enforced |
| non-null `!` assertions | 0 | none detected in source |
| `as` casts (typed targets) | 76 | mostly IPC/payload narrowing and test fixtures; review per pass, do not mass-remove |
| `void` promise markers | 51 | deliberate fire-and-forget; now also enforced by `no-floating-promises` |
| empty `catch {}` | 3 | inspect per pass; some are intentional best-effort cleanup |
| `TODO`/`FIXME`/`XXX` | 0 | no unbounded TODOs today |
| `console.*` calls | 55 | main-process/smoke diagnostics; do not blanket-ban |

### Templates, styles and documentation

- Inline templates: `onboarding-wizard` 217 lines, `sidebar-panel` 108, `session-tabs` 72, `assisted-input` 48, `app-header` 19, `message-center` 9, `status-footer` 9; `app.html` 75 lines.
- Component `styles` blocks (M20 exceptions, total 39 lines): onboarding 13 (settings dialog, STT glyphs/table), assisted-input 9 (editor typography, mic pulse), header 7 (drag regions, active wash), session-tabs 6 (state rules), sidebar 4 (active tab); `terminal-panel.css` remains the xterm-owned stylesheet.
- No inline `style="..."`, no `!important`, no palette literals outside `styles.css` and the four `TERMINAL_THEME` values.
- Exported APIs without a TSDoc summary (DOK-01 gap): `packages/contracts` 59 of 75 exports, `packages/ai` 9 of 11, `packages/data` 1 of 8, `packages/sync` 1 of 9, `packages/terminal` 1 of 5. Treat as a documentation backlog, not a behavior risk.

## Prioritized worklist

| # | Area / files | Risk | Benefit | Characterization needed | Owner |
| ---: | --- | --- | --- | --- | --- |
| 1 | IPC channel map split: `apps/desktop/src/main/ipc.ts` (`createChannelMap` 147 lines) | HIGH | Handlers grouped per domain, easier review | `ipc.spec.ts`, `test:ipc-smoke` | T06 |
| 2 | App bootstrap/window: `apps/desktop/src/main/main.ts` (163/135 lines) | HIGH | Extract E2E/smoke wiring from production boot | `test:e2e`, smokes | T06 |
| 3 | Onboarding class: `onboarding-wizard.ts` (842 lines) | MED | Separate STT test controller from wizard state | settings/STT setup smokes | T05 |
| 4 | STT/AI diagnostics mapping: `stt-service.ts`, `ai-service.ts`, `packages/ai/src/stt.ts` (`transcribeAudio` 96) | HIGH | One failure-shape vocabulary | `stt-service.spec.ts`, `packages/ai/src/stt.spec.ts` | T06 |
| 5 | Git engine: `packages/sync/src/git/git-engine.ts` (450-line class) | HIGH | Smaller command units, explicit serialization | `git-engine.spec.ts`, coordinator tests | T06 |
| 6 | Session id allocator: `packages/data/src/session-id.ts` | MED | Clarify locking/allocation invariants | `session-id.spec.ts` | T06 |
| 7 | Coordinator runtime: `coordinator-runtime.ts` | HIGH | Separate election, clipboard and search forwarding | `coordinator-runtime.spec.ts`, `test:coordinator` | T06 |
| 8 | Renderer stores duplication (`sessions-store`, `search-store`, `stt-store` subscription blocks) | MED | One subscription/cleanup pattern per store | `tests/renderer-*.spec.ts` | T05 |
| 9 | Composer/onboarding duplicated button-class strings (M20 utilities) | LOW | Shared `.btn`-based markup where states match | settings smoke, capture screenshots | T05 |
| 10 | Empty catches (3) and best-effort cleanup sites | LOW | Explicit comments or explicit failure | unit tests per site | T06 |
| 11 | TSDoc backlog for exported contracts/packages (DOK-01) | LOW | Consumer discoverability | doc checks | T07 |
| 12 | Spec fixture duplication (`renderer-sessions-store`, `renderer-stt-store`, `git-engine.spec`) | LOW | Shared deterministic fixtures without coverage loss | identical test results | T07 |

## Ownership and migration order

- T05 owns the renderer: app shell/sessions → terminal integration → sidebar/history → composer → settings/onboarding.
- T06 owns main and packages: contracts → data → terminal/PTY → sync/Git → AI/STT → preload/main IPC.
- One pass owns its files at a time; shared boundary changes are coordinated with the owning task instead of edited concurrently. Order is a plan, not permission to skip characterization.

## Fixtures and anchors

Behavioral anchors already exist and must stay green: `apps/desktop/src/main/smoke.ts` (IPC/tabs/search/clipboard/sidebar/settings/onboarding/AI/STT/remote scenarios), `npm run test:ipc-smoke`, `test:pty-smoke`, `test:stt-smoke`, `test:ai-smoke`, `test:sync-ui-smoke`, `test:tabs-smoke`, `test:settings-smoke`, `test:onboarding-smoke`, `test:e2e`, `npm run test:layout`, `scripts/capture-screenshots.mjs`, `npm run test:coordinator`.

Keyboard/focus: `docs/23 - ADR assisted input and terminal keyboard behavior.md`, `docs/24 - Input interaction matrix.md`, STT/AI smokes. Git election: `packages/sync/src/coordinator.spec.ts` (real multi-process). IPC/security: `apps/desktop/src/main/ipc.spec.ts`, `docs/13 - Security checklist.md`. Hardware/credentials/provider availability remain outside deterministic automated scope.

## Executable checks

Now enforced by `eslint.config.mjs` (type-aware via `projectService`, no new plugins, lint ≈3 s):

| Rule | Severity | Enforces |
| --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | error | TYPE-01 |
| `@typescript-eslint/consistent-type-imports` | error | TS-02 |
| `@typescript-eslint/no-unused-vars` | error | MOD-02 |
| `@typescript-eslint/no-floating-promises` | error | ASYNC-01 |
| `@typescript-eslint/no-misused-promises` (conditionals) | error | ASYNC-01/02 |
| `@typescript-eslint/await-thenable` | error | ASYNC-01 |
| `eqeqeq`, `prefer-const` | error | clarity baseline |
| TypeScript strict flags | compiler | TYPE-03, nullability |

Adopting these required 8 behavior-neutral fixes (explicit `void` on intentional fire-and-forget, wrapping an async interval callback, wrapping the election-loss enqueue, and widening the internal `ClipboardTextWriter` return type to the async `clipboard.writeText` it already returns). No new dependency was added.

Decision required before adoption: `@typescript-eslint/require-await` currently reports 37 advisories (mostly async test doubles and adapter shims); keep it out, or introduce it as a scoped warning for `packages/` first. Formatting is not automated today; a Prettier decision is out of scope for M21.

Enforcement strategy: rules are global and clean at the baseline; new violations fail lint immediately. Do not run sweeping `--fix` over untouched files; fix within the owning task and keep diffs scoped.

## Review rubric

- Behavior preserved: relevant unit tests, smokes and layout/visual anchors unchanged.
- Naming: domain terms match `packages/contracts` and existing stores/services.
- Clarity: early returns, small cohesive units, no hidden side effects.
- Abstraction: only when multiple real call sites share behavior (docs/29 PREF-07).
- Comments: invariants and intent, not narration (docs/31 CMT-01/02).
- Tests: deterministic, behavior-level, failure paths covered (docs/29 TEST-01/02).
- Diff scope: one coherent purpose, no cosmetic churn; exceptions recorded per docs/29.

## Known pre-existing conditions

- `docs/assets/screenshots` predate M20 and were not regenerated.
- Chromium persists per-host zoom; zoom evidence uses a throw-away `SMART_TERMINAL_USER_DATA`.
- M20 updated the capture `onboarding-stt` scenario to the current STT controls.
- M20 smoke/layout/zoom/packaging results are reported as provided by M20, not re-run in this T04 pass.

## M21 outcomes (updated during the refactor)

- T05 removed verified-dead renderer members (`debugSummary`, `micMessage`, `checkMicrophone`, `micState`/`MIC_MESSAGES`, `sttProviders`, `testingStt`, unused push-to-talk helpers), extracted four STT-test helpers from a 77-line method, deduplicated 18 dialog-button class strings and added recording/xterm lifecycle invariants. Layout, screenshot and smoke evidence stayed green.
- T06 split `createChannelMap` into six service-owned builders typed with `Pick<IpcChannelMap, ...>` (34 channels, unchanged validators/payloads), documented exported contract limits and removed 46 tautological comments that restated identifiers, and recorded PTY/schema/STT invariants.
- T07 replaced the duplicated config/secrets doubles with `apps/desktop/src/main/testing/stores.ts` and added a channel-map completeness test (exactly the declared channels, each with validator and handler). Suite grew from 408 to 409 tests and ran twice with identical results; no dead or duplicate test was found to remove.
- Process note: the T07 test changes were committed while T06 was still the active task (same working session); no scope overlapped and the independent audit records it.
