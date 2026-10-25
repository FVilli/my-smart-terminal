---
title: "M24 - T04 - Mask the stored AI token"
type: task
project: smart-terminal
created: 2026-10-25
id: "M24-T04"
milestone: "M24"
depends_on: "M24-T03"
deliverables: "Token field reflects a stored token with a masked placeholder without exposing it"
---

# M24 - T04 - Mask the stored AI token

## Implementation
- In the AI settings step, when `state.secureStorage`/`hasToken` is true (existing status signal) and the input is empty, show a masked placeholder (`••••••••••••`) and the hint "Token stored in the keychain — type to replace"; keep `type="password"`, `autocomplete="off"`.
- Typing clears the placeholder state visually (native placeholder) and submits only the typed value; leaving it empty keeps the stored token. Never read the token into the renderer.
- Add a small "stored" indicator with an accessible name; keep the existing save/validate behaviour and tests.
- Extend the AI-setup smoke to assert the placeholder/hint when a token is configured and absent otherwise.

## Acceptance
- Stored token never exposed; user can tell a token exists; save/replace flow unchanged; tests/smoke green.
