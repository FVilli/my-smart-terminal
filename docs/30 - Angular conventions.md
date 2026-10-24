---
title: "Angular conventions"
type: standard
project: smart-terminal
version: 1
created: 2026-10-24
---

# Angular conventions

## Installed baseline

The renderer uses Angular **22.2.3** (`@angular/core`) and TypeScript **6.0.3**. `angular.json` selects `@angular/build:application`; the renderer test target uses `@angular/build:unit-test`, and repository unit tests use Vitest 5.0.5. `tsconfig.base.json` enables `strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, and `isolatedModules`; `apps/renderer/tsconfig.json` enables `strictInjectionParameters`, `strictInputAccessModifiers`, and `strictTemplates`. Rules below must remain compatible with these installed versions. Do not infer availability from newer Angular documentation. The [official Angular style guide](https://angular.dev/style-guide) is the general style reference, not the source of this project's version facts.

## Rules

MUST is mandatory; SHOULD is the default and may be departed from with a reason; MAY is optional. Rule IDs are stable citations. These rules supplement, not duplicate, `docs/29 - Coding rules.md`; apply its TS, TYPE, ASYNC, MOD, SEC, TEST, PREF and STYLE rules as relevant.

### Components and TypeScript

- **NG-01 MUST** keep renderer UI components standalone and import their dependencies explicitly; bootstrap with `bootstrapApplication`. Rationale: this is the app's existing composition model. Reference: `apps/renderer/src/app/app.ts`, `apps/renderer/src/main.ts`.
- **NG-02 SHOULD** organize by feature with component files and their styles/tests co-located when those files exist; keep shared app state in the relevant feature store. Rationale: feature ownership remains discoverable. Reference: `apps/renderer/src/app/assisted-input/assisted-input.ts`, `apps/renderer/src/app/sessions-store.ts`.
- **NG-03 MUST** use the configured `app` selector prefix for selectors. Rationale: avoid collisions and keep renderer selectors recognizable. Reference: `angular.json` (`prefix: "app"`), `apps/renderer/src/app/terminal-panel.ts`.
- **NG-04 MUST** set `ChangeDetectionStrategy.OnPush` on renderer components. Rationale: makes the intended rendering strategy explicit and limits avoidable checks. Reference: `apps/renderer/src/app/header/app-header.ts`.
- **NG-05 SHOULD** use `inject()` rather than constructor injection for component/store dependencies, and initialize dependencies explicitly rather than doing side-effectful work in constructors. Rationale: this matches current renderer composition and makes lifecycle work visible. Reference: `apps/renderer/src/app/header/app-header.ts`, `apps/renderer/src/app/app.ts`.
- **NG-06 SHOULD** declare component inputs/outputs with typed `input()` and `output()` (and `model()` only where two-way model ownership is genuinely required); retain readonly declarations for stable references. Rationale: explicit contracts are easier to inspect. Reference: `apps/renderer/src/app/session-tabs/session-tabs.ts`, `apps/renderer/src/app/assisted-input/assisted-input.ts`.
- **NG-07 SHOULD** mark template-only members `protected`, implementation-only dependencies `private`, and stable injected/state references `readonly` where mutation of the reference is not needed. Rationale: expose only the component surface actually used. Reference: `apps/renderer/src/app/header/app-header.ts`, `apps/renderer/src/app/assisted-input/assisted-input.ts`.
- **NG-08 MAY** use signal-based `viewChild`/`contentChild` queries when template references are needed; query with the appropriate optional/required semantics and type. Rationale: query availability is part of the template contract. Reference: `apps/renderer/src/app/assisted-input/assisted-input.ts` (`viewChild.required`).
- **NG-09 SHOULD** use `host: {}` metadata for host attributes, classes, and listeners rather than adding manual `@HostBinding`; do not rewrite established behavior without a functional reason. Rationale: host behavior stays in component metadata. Reference: `apps/renderer/src/app/terminal-panel.ts`, `apps/renderer/src/app/onboarding/onboarding-wizard.ts`.

### State and async

- **SIG-01 SHOULD** use signals for synchronous renderer-owned state and `computed()` for pure derived state; stores currently expose signal state, including `SessionsStore`'s active session and draft. Rationale: ownership and derivation remain explicit. Reference: `apps/renderer/src/app/sessions-store.ts`, `apps/renderer/src/app/appearance/appearance-store.ts`.
- **SIG-02 MUST** use `effect()` only to synchronize with an external side effect or boundary, not to derive state that belongs in `computed()`; do not introduce a second source of truth. Rationale: derived values should stay declarative and duplicate state drifts. Reference: `apps/renderer/src/app/app.ts`, `apps/renderer/src/app/assisted-input/assisted-input.ts`.
- **SIG-03 SHOULD** retain RxJS/observable or callback-stream patterns where event-stream semantics, IPC listeners, cancellation, or subscription composition justify them; do not perform blanket RxJS-to-signals migrations without evidence. Rationale: IPC events are asynchronous streams with cleanup contracts. Reference: `docs/11 - IPC contracts and runtime verification.md`, `apps/renderer/src/app/sessions-store.ts`.
- **SIG-04 MUST** release acquired listeners, subscriptions, timers, and xterm disposables with their owner; use `OnDestroy` or the existing store lifecycle where appropriate. Clear timers and stop/release audio resources, and invoke preload unsubscribe functions. Rationale: callbacks/resources must not outlive their owner. Reference: `apps/renderer/src/app/terminal-panel.ts`, `apps/renderer/src/app/assisted-input/assisted-input.ts`, `apps/renderer/src/app/onboarding/onboarding-wizard.ts`.
- **SIG-05 MUST** keep IPC calls behind the typed preload API; never access Electron internals or bypass preload from renderer code. Treat event listeners as subscriptions and invoke their returned cleanup. Rationale: preload is the security boundary. Reference: `docs/11 - IPC contracts and runtime verification.md`, `apps/renderer/src/app/sessions-store.ts`.
- **SIG-06 MUST** preserve STT/audio lifecycle ownership: stop recording, clear timeout state and release audio resources on completion, error, or owner teardown; transcription appends to the assisted draft and does not submit it. Rationale: audio is a bounded sensitive resource and dictated text requires explicit user submission. Reference: `apps/renderer/src/app/stt/stt-store.ts`, `docs/23 - ADR assisted input and terminal keyboard behavior.md`.

### Templates, styling, and interaction

- **TPL-01 SHOULD** use built-in `@if`/`@for` control flow and a stable `track` key for repeated entities. Rationale: identity stays stable across list updates. Reference: `apps/renderer/src/app/session-tabs/session-tabs.ts`, `apps/renderer/src/app/terminal-panel.html`.
- **TPL-02 MUST** keep business logic out of templates; avoid heavy expressions and move decisions/derivations into typed component or store members. Rationale: templates should communicate structure, not implement domain behavior. Reference: `apps/renderer/src/app/app.html`, `apps/renderer/src/app/sessions-store.ts`.
- **TPL-03 MUST** use semantic HTML, accessible names, appropriate roles, keyboard operation and visible focus; do not remove or degrade `:focus-visible`/focus indication or reduced-motion behavior. Rationale: all interactions must be operable without pointer-only assumptions. Reference: `apps/renderer/src/app/onboarding/onboarding-wizard.ts`, `docs/23 - ADR assisted input and terminal keyboard behavior.md`.
- **TPL-04 MUST** treat existing `data-testid` values used by smoke tests as stable contracts; update tests and obtain review before changing one. Rationale: selectors are part of the smoke-test interface. Reference: `apps/desktop/src/main/smoke.ts`, `apps/renderer/src/app/sidebar-panel/sidebar-panel.ts`.
- **TPL-05 MUST** use Tailwind utilities and M20 tokens for normal layout/visuals; do not add inline styles or literal palette colors. Component CSS is reserved for documented complex/platform-specific rules; the xterm theme is an existing justified exception. Rationale: one token owner preserves the verified visual baseline. Reference: `docs/28 - Renderer styling audit.md`, `docs/15 - Visual baseline.md`.
- **TPL-06 SHOULD** use class/style bindings only for dynamic presentation state and keep their expressions simple; do not use presentation bindings to smuggle domain logic. Rationale: view state stays separate from behavior. Reference: `apps/renderer/src/app/terminal-panel.ts`, `apps/renderer/src/app/app.html`.

### Interop, tests, and performance

- **INT-01 MUST** preserve the xterm/PTY ownership contract: no app-level rewriting/interception of terminal input except the specifically approved zoom shortcuts; assisted-input submission remains explicit. Focus moves must preserve drafts and focus visibility. Rationale: shells, TUIs and SSH own terminal bytes. Reference: `docs/23 - ADR assisted input and terminal keyboard behavior.md`, `apps/renderer/src/app/terminal-panel.ts`.
- **INT-02 MUST** use documented typed IPC/preload methods and their exact payload/result contracts; renderer must never reach filesystem, process, credentials or main-process services directly. Rationale: renderer is isolated and untrusted. Reference: `docs/11 - IPC contracts and runtime verification.md`, `docs/06 - Stack and code structure.md`.
- **TEST-01 SHOULD** test component and store observable behavior with deterministic fixtures; assert public interactions, rendered states and boundary outcomes, not private implementation details. Rationale: behavior tests survive internal refactors. Reference: `apps/renderer/src/app/terminal-copy.spec.ts`, `docs/29 - Coding rules.md` (TEST-01/02).
- **TEST-02 MUST** add characterization coverage before a risky refactor when relied-upon behavior lacks adequate coverage, especially PTY input/focus, assisted submission, STT, IPC, or smoke anchors. Rationale: refactoring must not silently alter boundary contracts. Reference: `docs/23 - ADR assisted input and terminal keyboard behavior.md`, `docs/11 - IPC contracts and runtime verification.md`.
- **PERF-01 SHOULD** avoid unnecessary render churn and speculative memoization; profile or identify a concrete repeated cost before optimizing. Rationale: complexity without measured benefit obscures ownership. Reference: `apps/renderer/src/app/sessions-store.ts`.
- **PERF-02 MUST** preserve accessible focus and reduced-motion behavior during visual or interaction changes; do not introduce motion that cannot be reduced. Rationale: animation must not impair keyboard access or users sensitive to motion. Reference: `docs/23 - ADR assisted input and terminal keyboard behavior.md`, `apps/renderer/src/app/assisted-input/assisted-input.ts`.

## Explicit prohibitions

- Business logic in presentation components beyond UI orchestration (NG-02, TPL-02).
- Extra wrapper components/services with no distinct ownership or behavior (NG-02; `docs/29 - Coding rules.md` MOD-02).
- Duplicate state or effect-driven derived state (SIG-02).
- Cosmetic rewrites bundled with behavior/refactor work (TPL-05; `docs/29 - Coding rules.md` PREF-01).
- Forced migrations, including blanket observable-to-signal conversion (SIG-03).
- Version-incompatible Angular APIs or examples (installed baseline above).
- New Angular dependencies without explicit approval (`docs/29 - Coding rules.md` PLAT-01).
- Bypassing preload, altering PTY ownership, or silently changing smoke-test selectors (INT-01/02, TPL-04).

## Decision guide

| Choice | Prefer | Choose the alternative when |
| --- | --- | --- |
| Signals or Observables | Signals for synchronous state owned by a renderer store; `computed()` for derivation (SIG-01/02). | Observable/callback stream semantics, IPC events, or subscription composition are the actual contract (SIG-03). |
| Component or service/store | Component for rendering, local interaction and orchestration. | State or behavior has shared/domain ownership or must outlive one view (NG-02, SIG-01). |
| Add an abstraction? | Keep one clear implementation. | Multiple real call sites share behavior and the abstraction makes ownership/test seams clearer (NG-02; `docs/29 - Coding rules.md` MOD-02/PREF-07). |

## Agent checklist

- [ ] Confirm change scope and applicable `docs/29` IDs; avoid unrelated churn (NG-01).
- [ ] Keep standalone component imports explicit and prefix selectors correctly (NG-01, NG-03).
- [ ] Preserve OnPush and use typed input/output/model contracts where needed (NG-04, NG-06).
- [ ] Keep references readonly and template-only members protected where appropriate (NG-07).
- [ ] Keep feature layout and store/component ownership clear (NG-02).
- [ ] Choose signal/computed/effect or stream based on ownership and async semantics (SIG-01–03).
- [ ] Check for duplicate state and ensure effects synchronize side effects only (SIG-02).
- [ ] Give listeners, subscriptions, timers, xterm and audio resources an owner and cleanup (SIG-04, SIG-06).
- [ ] Use preload exclusively; validate event/call behavior against IPC contracts (SIG-05, INT-02).
- [ ] Preserve xterm input, assisted-input focus and submission contracts (INT-01).
- [ ] Keep templates simple, use stable tracking, and retain accessible semantics/focus (TPL-01–03).
- [ ] Preserve smoke-test `data-testid` anchors or update their test contract (TPL-04).
- [ ] Use M20 utilities/tokens; avoid inline styles and literal colors (TPL-05/06).
- [ ] Add deterministic observable-behavior tests and characterize risky existing behavior (TEST-01/02).
- [ ] Avoid unmeasured optimization and preserve reduced-motion/accessibility behavior (PERF-01/02).
