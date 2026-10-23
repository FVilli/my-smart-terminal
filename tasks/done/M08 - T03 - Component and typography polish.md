---
title: "M08 - T03 - Component and typography polish"
type: task
project: smart-terminal
created: 2026-10-23
id: "M08-T03"
milestone: "M08"
depends_on: "T02"
deliverables: "Component and typography polish"
---
<!-- gsynchro:v1 id=7456b128-4487-4a68-95e7-17b3048e1f59 registered=2026-10-23T12:22:14.923Z -->

# M08 - T03 - Component and typography polish

## Objective
Polish tab, sidebar, editor and footer components to match the mock hierarchy and visual language.

## Constrained implementation
Tune tab padding/active state/close affordance, sidebar tab headers/search/machine filter/cards, assisted-input toolbar (AI, send, mic, Voice ready), footer sync/primary indicators, icon sizing, borders/radius, hover/focus/disabled states and monospace typography. Preserve accessibility labels and English copy. Keep the layout stable under long text, many history entries and narrow windows.

## Acceptance criteria
Visual review against the mock passes for tabs/sidebar/input/footer; focus/hover states are visible; long text truncates/scrolls without overflow; screenshots at 1440x900 and 1024x700 show the target palette and hierarchy; smoke tests for tabs/editor/sidebar/clipboard remain green.

## References
docs/02; docs/08; docs/assets/screenshots; apps/renderer/src/app/**.

## Do not
Do not change functional behavior or add dependencies.
