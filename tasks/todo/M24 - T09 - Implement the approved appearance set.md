---
title: "M24 - T09 - Implement the approved appearance set"
type: task
project: smart-terminal
created: 2026-10-25
id: "M24-T09"
milestone: "M24"
depends_on: "M24-T08"
deliverables: "Implementation of the approved appearance options with tests and visual evidence"
---

# M24 - T09 - Implement the approved appearance set

## Implementation
- Implement exactly the options approved in docs/39: theme light/dark (semantic tokens, xterm theme, onboarding/settings/assisted surfaces), terminal font and any approved extras; persistence and migration per design.
- Add settings controls under Appearance, accessible and token-based; preview updates immediately; no restart.
- Update xterm theme mapping, M20 tokens and visual baseline; capture both themes at 1440×900/1024×700 and zoom levels.
- Tests: config persistence/migration, token contrast checks where automatable, appearance store; smokes extended; docs updated.

## Acceptance
- Approved options work and persist; dark remains the default and pixel-compatible with the current baseline; light meets AA; tests/smokes/captures green.
