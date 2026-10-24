---
title: "Coding rules"
type: standard
project: smart-terminal
version: 1
created: 2026-10-24
---

# Coding rules

## Purpose and scope

This rulebook applies to TypeScript in the Angular renderer (`apps/renderer`), Electron main and preload (`apps/desktop`), and shared workspace packages (`packages/contracts`, `terminal`, `data`, `sync`, `ai`); Markdown documentation; and shell/MJS scripts. All contributors and workers MUST read it before starting any task; deviations MUST be declared in the task/PR and reviewed.

The boundaries are deliberate: renderer UI, privileged Electron main, narrow preload bridge, typed shared contracts, and domain packages. Examples below refer to current code, including `apps/desktop/src/main/ipc.ts`, `apps/desktop/src/preload/preload.ts`, `packages/contracts/src/index.ts`, `packages/terminal/src/session-manager.ts`, `packages/data/src/schema.ts`, `packages/sync/src/coordinator.ts`, `packages/ai/src/stt.ts`, and renderer stores such as `apps/renderer/src/app/sessions-store.ts`.

## Rule language

**MUST** is mandatory; **SHOULD** is the default unless a documented reason argues otherwise; **MAY** is optional. IDs are stable citations for reviews. MUSTs are normative; a SHOULD deviation follows the exception process below.

## Mandatory rules

### Naming, exports, and dependencies

- **TS-01 MUST** use established domain names and specific identifiers; keep terminal session, sync role/status, AI/STT, and IPC vocabulary consistent with `packages/contracts/src/index.ts` and `docs/11 - IPC contracts and runtime verification.md`. Rationale: names are part of the boundary contract.
- **TS-02 MUST** use explicit imports/exports and type-only imports where appropriate; `consistent-type-imports` is enforced by ESLint. Import cross-package APIs through `@smart-terminal/contracts`, `@smart-terminal/terminal`, `@smart-terminal/data`, `@smart-terminal/sync`, or `@smart-terminal/ai`, not deep relative paths. Rationale: preserve package ownership and avoid relative-path spaghetti. Good: `@smart-terminal/contracts`; bad: traversing from a package into another package's `src`.

### Types and contracts

- **TYPE-01 MUST NOT** use `any` without a written, justified exception; `@typescript-eslint/no-explicit-any` is an ESLint error. Prefer a concrete type or `unknown` narrowed at the boundary. Rationale: unchecked values erase the guarantees of strict TypeScript.
- **TYPE-02 MUST** treat values crossing IPC, filesystem, network, or process boundaries as untrusted and validate/narrow them before use. `apps/desktop/src/main/ipc.ts` validates requests; `packages/data/src/schema.ts` validates stored data. Unguarded `as` casts are forbidden; a cast needs a locally evident invariant and is still exception-worthy if it bypasses validation.
  Bad: `const request = value as SttTranscribeRequest;` in a new IPC handler. Good: validate with the existing guard/validator and return the coded error shape instead of casting the payload.
- **TYPE-03 MUST** account for `noUncheckedIndexedAccess`: indexed/lookup results may be `undefined`, so check before use. Rationale: a key or array index is not proof of an element.
- **TYPE-04 MUST** represent fallible results and event variants with discriminated unions or explicit structured outcomes, not ambiguous booleans/nullable payload combinations. Follow result/event types in `packages/contracts/src/index.ts`. Rationale: callers must be able to exhaustively distinguish states.

### Errors, nullability, and async

- **ERR-01 MUST** distinguish absence (`null`/`undefined`) from failure and define an explicit failure shape at API boundaries; do not silently swallow errors. Handle or propagate errors with context. Rationale: callers need reliable recovery and diagnostics.
- **ERR-02 MUST** keep IPC failures coded and sanitized: never expose raw exceptions, stacks, paths, tokens, or provider response bodies to renderer. Follow `apps/desktop/src/main/ipc.ts` and the sanitized service results in `apps/desktop/src/main/stt-service.ts`. Rationale: renderer is an untrusted boundary and diagnostics can contain secrets.
  Bad: `throw error` (or `{ error: String(error) }`) from an IPC handler. Good: map the failure to the documented result/diagnostic shape and keep raw details in main-process logs only.
- **ASYNC-01 MUST** make asynchronous work observable: await it, return its promise, or explicitly handle rejection; no floating promises. Use cancellation (`AbortSignal`) or bounded timeouts for interruptible external work. Rationale: prevent unowned work and hangs.
  Bad: `void saveSession(...)` in `session-manager.ts` with no rejection handling. Good: `await` it inside the owning operation or attach an explicit `.catch` that reports a sanitized failure.
- **ASYNC-02 MUST** assign cleanup to the component that acquires the resource and release subscriptions, timers, child processes, and listeners on completion/disposal. Follow unsubscribe-capable preload event APIs and lifecycle handling in `packages/terminal/src/session-manager.ts`. Rationale: resource ownership prevents leaks and stale callbacks.
- **ASYNC-03 MUST NOT** hide I/O or process startup in constructors; initialize through explicit methods/functions whose async failure and lifecycle are visible. Rationale: construction should not create unobservable side effects.

### Modules and maintainability

- **MOD-01 MUST** keep functions and modules cohesive, with explicit side effects and early exits for invalid/precondition cases. Prefer pure helpers where practical; see validation/helpers in `packages/data/src/paths.ts`. Rationale: small behavior units are easier to reason about and test.
- **MOD-02 MUST NOT** add dead code, commented-out code, speculative abstractions, or redundant wrapper layers. A TODO must state a concrete action and context; vague TODOs are forbidden. Rationale: unused alternatives and vague intent obscure actual behavior.

### Security and process boundaries

- **SEC-01 MUST** treat Electron IPC and preload as security boundaries: validate sender, channel, exact payload shape, ranges, and size in main; expose only narrow whitelisted preload methods. Do not add channels or generic invoke surfaces without an approved contract update. See `apps/desktop/src/preload/preload.ts` and `apps/desktop/src/main/ipc.ts`. Rationale: renderer input is untrusted.
- **SEC-02 MUST** document trust assumptions at newly introduced boundaries and validate paths (including containment/symlink conditions) before filesystem access. Follow `packages/data/src/paths.ts` and `apps/desktop/src/main/navigation.ts`. Rationale: path strings can escape intended roots.
- **SEC-03 MUST** keep secrets in the main process/keychain-backed `safeStorage` flow; never return or log tokens, audio, raw provider bodies, or sensitive user content. Redact diagnostics. Follow `apps/desktop/src/main/secret-store.ts` and `docs/13 - Security checklist.md`. Rationale: logs and renderer results expand exposure.
- **PLAT-01 MUST NOT** introduce SQL/SQLite or another persistence service; the approved model is Markdown + Git. No runtime dependency may be added without an explicit decision. Rationale: preserve the approved storage and dependency boundaries.
- **PLAT-02 MUST** preserve native PTY rebuild constraints for `node-pty`; changes to native dependencies require the documented rebuild path (`npm run rebuild:native`) and an explicit compatibility check. Rationale: Electron native ABI must match.

### Tests

- **TEST-01 MUST** test observable behavior and public contracts, including rejection/failure paths at boundaries; assert meaningful outcomes rather than implementation details. Follow `apps/desktop/src/main/ipc.spec.ts` and `packages/data/src/schema.spec.ts`. Rationale: regressions commonly occur at boundary failures.
- **TEST-02 MUST** use deterministic fixtures and avoid real network, credentials, or uncontrolled timing in routine tests. Rationale: reproducible tests make failures actionable.
- **TEST-03 MUST** add characterization coverage before risky refactors where current behavior is relied upon but otherwise undocumented. Rationale: lock down behavior before restructuring.

### Documentation and styling

- **DOC-01 MUST** follow the dedicated documentation policy in M21-T03 (`docs/31`); do not duplicate that policy here. Rationale: one authoritative documentation standard.
- **STYLE-01 MUST** follow the M20 styling tokens and ownership guidance in `docs/28 - Renderer styling audit.md` and the current styling specifications; do not restate or fork token definitions here. Rationale: one source of visual truth.

## Preferred and context-dependent practices

These SHOULDs are defaults, not unconditional requirements. Record a reason when departing from them.

- **PREF-01 SHOULD** favor the smallest change that solves the task; avoid unrelated refactoring.
- **PREF-02 SHOULD** use descriptive names, explicit return types where they clarify public boundaries, and exhaustive `switch` handling for unions.
- **PREF-03 SHOULD** prefer pure helpers and dependency injection/seams that make tests deterministic; do not create abstractions until multiple real use cases justify them.
- **PREF-04 SHOULD** use cancellation and timeouts suited to the operation; a bounded operation that cannot be cancelled may use timeout alone.
- **PREF-05 SHOULD** keep commits small and scoped, with one coherent purpose. Follow the sequencing, dependency, and verification workflow in `docs/WORKFLOW.md`; do not combine cosmetic churn with a refactor commit.
- **PREF-06 SHOULD** request independent review for security, IPC, persistence, or process-boundary changes, and review the resulting diff and relevant tests before merge, consistent with `docs/WORKFLOW.md`'s specification/deviation and verification steps.
- **PREF-07 MAY** use a small local abstraction when it removes real duplication without hiding ownership or adding a redundant layer.

The following are explicitly forbidden: `any` without a written justified exception; unguarded `as`; commented-out code; vague TODOs; speculative abstraction; cosmetic churn in refactor commits.

## Exceptions

Record each exception in the task/PR description (or linked decision record before implementation) with: rule ID; reason and alternatives considered; blast radius/boundary affected; named reviewer; expiry date or concrete cleanup condition. The reviewer must explicitly approve it. Exceptions do not silently amend this standard; remove the exception when its expiry/cleanup condition is met. Security and architecture decisions still require the approvals specified by the relevant contracts and `docs/WORKFLOW.md`.

## Reviewer checklist

- [ ] Scope and domain names follow existing contracts. (TS-01, TS-02)
- [ ] Imports use package entry points and type imports where appropriate. (TS-02)
- [ ] No implicit `any`; boundary values are narrowed and casts justified. (TYPE-01, TYPE-02)
- [ ] Indexed values and union variants are safely handled. (TYPE-03, TYPE-04)
- [ ] Absence, failure, and propagated errors are distinguishable. (ERR-01)
- [ ] IPC errors are coded, sanitized, and secret-free. (ERR-02, SEC-03)
- [ ] Async operations are handled, bounded/cancellable where appropriate, and cleanup has an owner. (ASYNC-01, ASYNC-02, ASYNC-03)
- [ ] Modules have cohesive responsibilities and no dead/commented-out/vague-TODO code. (MOD-01, MOD-02)
- [ ] IPC/preload exposure and filesystem paths preserve trust boundaries. (SEC-01, SEC-02)
- [ ] No prohibited persistence/runtime dependency; native PTY constraints considered. (PLAT-01, PLAT-02)
- [ ] Tests cover behavior, deterministic setup, and failure paths. (TEST-01, TEST-02, TEST-03)
- [ ] Documentation and renderer styling follow their dedicated sources. (DOC-01, STYLE-01)
- [ ] Diff is scoped, cosmetic churn excluded, and appropriate independent review obtained. (PREF-01, PREF-05, PREF-06)
- [ ] Any deviation has a complete, approved, time-bounded exception entry. (Exceptions)

## Worker quick start

Before touching code, spend five minutes:
1. Read this rulebook and the task's acceptance criteria; identify applicable rule IDs.
2. Read `docs/WORKFLOW.md` and the relevant boundary documents (`docs/11 - IPC contracts and runtime verification.md`, `docs/13 - Security checklist.md`, and/or `docs/28 - Renderer styling audit.md`).
3. Inspect the named files, package exports, and nearby tests; verify the requested boundary and current conventions rather than assuming.
4. Check the worktree and scope; plan a small change and its validation commands.
5. Flag any missing approval/exception before implementation; record deviations in the task/PR and seek independent review where applicable.
