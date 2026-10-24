---
title: "M21 - T02 - Define modern Angular conventions"
type: task
project: smart-terminal
created: 2026-10-24
id: "M21-T02"
milestone: "M21"
depends_on: "M21-T01"
deliverables: "docs/27 - Angular coding conventions.md and Angular review checklist"
---
<!-- gsynchro:v1 id=13f25d8e-66a7-4872-bc94-312ae1a0ef72 registered=2026-10-24T22:31:29.286Z -->

# M21 - T02 - Define modern Angular conventions

## Objective
Define Angular practices based on the installed major version and official guide, not assumptions about the newest release.

## Implementation
- Record installed Angular/TypeScript versions and build configuration; reference https://angular.dev/style-guide.
- Require standalone, feature-oriented file layout, co-located tests and templates, focused presentation components and narrow services.
- Prefer `inject()`, typed inputs/outputs and `readonly` where supported; use `protected` for template-only state where supported.
- Define when to use signals/computed/effect vs RxJS/observables; no duplicated sources of truth; effects are for side effects, not propagation of derivable state.
- Define template rules: readable expressions, built-in control flow (`@if`, `@for` with stable `track`) where supported, semantic HTML, keyboard and screen-reader access, class/style bindings and Tailwind tokens from M20.
- Define change detection, lifecycle cleanup, subscription ownership, interop with xterm and IPC, testability and error boundaries; no blanket OnPush/signal migrations without regression evidence.
- Explicitly ban large template expressions, business logic in presentation classes, extra Angular wrappers and cosmetic rewrites.

## Acceptance
Angular conventions have concrete supported API examples and an agent checklist; incompatibilities and migration exceptions are documented; no application behavior changed.
