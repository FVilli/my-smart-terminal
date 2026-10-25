---
title: "M22 - T04 - Build the AI actions modal"
type: task
project: smart-terminal
created: 2026-10-25
id: "M22-T04"
milestone: "M22"
depends_on: "M22-T02, M22-T03"
deliverables: "Accessible AI actions modal opened from the composer button, with action selection, prompt prefill, sending and answer states"
---

# M22 - T04 - Build the AI actions modal

## Objective
Implement the modal defined in T01 on top of the T02 environment and T03 services, without changing the terminal surface.

## Implementation
- New standalone renderer component (feature folder) rendered from the app shell, opened by the composer `[AI]` button. Reuse the existing modal patterns (backdrop, dialog, focus trap) and M20 tokens/utilities; no new visual language, no inline styles, no palette literals.
- Header shows the active session label and environment (`os · shell`, `unknown` when undetected) plus provider/model status from `AiStore`; a warning row appears when AI is unconfigured.
- Action list: five options with title and one-line description; selecting one calls `ai:compose` with the current draft (or empty), fills the editable prompt textarea, and clears any previous answer.
- Send: disabled when unconfigured, prompt empty/over limit, or a request is in flight; shows a spinner and preserves the typed prompt; calls `ai:action`; renders the sanitized answer or error/timeout state.
- Answer area is read-only and selectable; the `Use` button is enabled only when an answer exists.
- Accessibility: `role="dialog"` + `aria-modal`, labelled header, focus on the first action, focus trap, Escape closes (same semantics as `Close`), focus returns to the composer button, all controls keyboard-operable, visible focus rings preserved.
- State lives in a narrow feature store/service so T05 can consume the answer and selection; no business logic in the template beyond bindings.
- Tests: store/component tests for state transitions (open/select/send/error/close), disabled logic, and a deterministic Electron smoke scenario (`SMART_TERMINAL_AI_MODAL_SMOKE=1`) that opens the modal, selects an action, composes and receives test-mode text.

## Acceptance
- Modal opens/closes from the composer, never blocks the terminal, and renders correctly at 1440×900 and 1024×700 plus 50–200 % zoom.
- All five actions prefill a prompt with session context when known; sending shows loading, answer and error states correctly.
- Keyboard and screen-reader flow verified; no layout regression in the M20 baseline.
- Lint, typecheck, tests and build pass; no new dependency.
