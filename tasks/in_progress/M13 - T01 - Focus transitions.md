---
title: "M13 - T01 - Focus transitions"
type: task
project: smart-terminal
created: 2026-10-23
id: "M13-T01"
milestone: "M13"
depends_on: "M12"
deliverables: "Explicit terminal/composer focus transitions with accessible, discoverable shortcut"
---

# M13 - T01 - Focus transitions

## Objective
Let users move between xterm and the composer without stealing terminal keys.

## Constrained implementation
Implement `Ctrl+Shift+E` (Cmd+Shift+E on macOS) to focus the assisted textarea without clearing the draft. From the composer, Escape returns focus to the active xterm and preserves the draft. Clicking either surface focuses it. Tab activation continues to focus xterm. After a successful send, focus remains in the composer. Expose the shortcut in the composer/help affordance and ensure focus rings are visible. Do not intercept any other terminal key.

## Acceptance
Shortcut works from terminal focus; Escape works from composer; drafts survive both; tab activation focuses terminal; first key after transition reaches the intended surface; no PTY key beyond the M12 zoom exception is consumed.
