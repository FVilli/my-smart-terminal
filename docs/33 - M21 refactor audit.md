---
title: "M21 refactor audit"
type: audit
project: smart-terminal
created: 2026-10-24
---
# M21 refactor audit

Final audit for milestone M21 (code quality and modern Angular refactoring). Baseline and inventory: `docs/32 - Refactor baseline and inventory.md`. Rules: `docs/29`, `docs/30`, `docs/31`. M21 range: commits after the M20 closure (`dc78556..HEAD`), 31 files, +1029/−165 lines, no dependency or lockfile change.

## Deliverables

| Task | Outcome |
| --- | --- |
| T01 | `docs/29 - Coding rules.md`: MUST/SHOULD/MAY rules with stable IDs, local Good/Bad examples, exception process, reviewer checklist. |
| T02 | `docs/30 - Angular conventions.md`: version-grounded (Angular 22.2.3, TypeScript 6.0.3) rules for standalone composition, `inject`, typed inputs/outputs, signals vs observables/effects, templates/accessibility, cleanup, xterm/IPC interop. |
| T03 | `docs/31 - Comments and documentation policy.md`: when comments are required or forbidden, TSDoc expectations, TODO policy, documentation ownership map, legacy-comment triage. |
| T04 | `docs/32`: measured baseline, file/function/class inventory, marker counts, 12-item worklist, ownership boundaries, behavioral anchors, enforced-rules table, review rubric. `eslint.config.mjs` adopts type-aware rules with 8 behavior-neutral fixes. |
| T05 | Renderer cleanup: dead members removed, four STT-test helpers extracted from a 77-line method, 18 duplicated class strings replaced by `dialogButtonClass`, recording/blob/disposer/xterm invariants documented. |
| T06 | `createChannelMap` split into six service-owned builders typed with `Pick<IpcChannelMap, ...>`; TSDoc for exported contract limits and sanitized failure semantics; 46 tautological comments removed; PTY/schema/STT invariants documented. |
| T07 | Shared `stubStores` test double; channel-map completeness test; suite 408 → 409 tests, deterministic across two runs; no dead or duplicate tests found. |
| T08 | Independent review of the committed M21 diff and exported evidence: verdict **acceptable**, no findings (limits of evidence noted below). |

## Enforced checks

`npm run lint` now type-checks the project graph through `projectService` (no new plugin, ~3 s) and fails on `no-floating-promises`, `no-misused-promises` (conditionals), `await-thenable`, `eqeqeq`, `prefer-const`, plus the existing `no-explicit-any`, `consistent-type-imports`, `no-unused-vars`. The eight findings this surfaced were fixed without behavior change: explicit `void` on intentional fire-and-forget calls, one async interval callback wrapped in a voided IIFE, the election-loss enqueue wrapped, and `ClipboardTextWriter` widened to the async Electron clipboard call it already returned (still awaited by `dispatchIpc`). No `eslint-disable` was introduced.

`require-await` stays out (37 advisories, mostly test doubles) and formatting is not automated; both are recorded decisions, not silent gaps.

## Verification matrix

| Gate | Result |
| --- | --- |
| `npm run lint`, `npx tsc -p tsconfig.json --noEmit` | pass |
| `npx vitest run` (twice) | 38 files, 409 tests, identical results |
| `npm run build` | pass |
| `npm run test:doc-consistency`, `test:docs-links`, `test:install-docs` | pass |
| `npm run test:layout` (1440×900, 1024×700) | ratio 0.75, no overflow, header 35, tabs 38, composer 137, footer 28, exact token colors |
| Zoom 50/100/200 (`SMART_TERMINAL_CAPTURE_ZOOM`, throw-away profile) | ratio preserved, no overflow (±1 px rounding at 50 %) |
| `scripts/capture-screenshots.mjs` | 8/8 scenarios OK; zero pixel diff for terminal/tabs/SSH/history/clipboard/AI-settings/STT-settings, only the known nondeterministic temp-path (~1.5k px) and clipboard timing (15 px) |
| Electron smokes (IPC, tabs, search, clipboard, sidebar, settings, onboarding, AI, STT, PTY, sync UI, remote setup, AI setup, STT setup) | 14/14 `ok:true` |
| `scripts/e2e-multi-instance.mjs` | primary takeover and cross-machine marker OK |
| `npm run package:deb` + `npm run test:deb` | package metadata, desktop entry and install flow OK |

Manual/hardware-dependent checks remain out of scope: a physical microphone/provider, Windows/macOS installers, and real remote Git hosts. Their deterministic fixtures are covered by the smokes above.

## Behavior and rule compliance

- No IPC channel, payload, validator, data schema, styling token, dependency or framework change. `eslint.config.mjs` is the only configuration change.
- Dead code removal was verified by reference search before deletion (renderer members listed in the T05 commit; `debugSummary` and the obsolete mic-check flow had no template references).
- The channel split keeps every key, validator, handler and `maxPayloadBytes`; a completeness test now fails if a declared channel is missing or extra.
- Comments follow `docs/31`: intent/invariants and contract limits only; the 46 "Contract for X data." restatements introduced during the T06 documentation pass were removed as noise.
- Tailwind/token ownership from M20 is unchanged; remaining component CSS is the documented exception set.

## Process notes and limits

- The T07 test consolidation was committed while T06 was still the active task in the same session; scopes did not overlap, but the sequence deviates from the planned T06 → T07 order and is recorded here.
- The independent review was evidence-based (diff plus exported logs); it verifies the exercised paths and code inspection, not a formal equivalence proof of every runtime path.
- `docs/assets/screenshots` still predate M20; the M21 comparisons use the harness output and the M20 baseline captures.

## Residual debt and follow-up backlog

From `docs/32` (unchanged priority): `main.ts` bootstrap/window extraction, `GitEngine` and `CoordinatorRuntime` decomposition, `OnboardingWizard` split of STT test state, renderer store duplication, three empty catches to classify, and the remaining internal/exported TSDoc beyond the packages covered in T06. None of these is a known defect; they are maintainability candidates for a later milestone.
