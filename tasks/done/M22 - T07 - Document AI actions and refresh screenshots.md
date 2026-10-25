---
title: "M22 - T07 - Document AI actions and refresh screenshots"
type: task
project: smart-terminal
created: 2026-10-25
id: "M22-T07"
milestone: "M22"
depends_on: "M22-T06"
deliverables: "Updated AI/security, IPC, UX, manual, provider and design documentation with verified screenshots"
---

# M22 - T07 - Document AI actions and refresh screenshots

## Objective
Describe the shipped behaviour accurately and keep the documentation gates green.

## Implementation
- Finalize `docs/34 - M22 AI actions design proposal.md` as the implemented design (states, copy, keyboard map, environment fields).
- Update `docs/05 - AI, voice and security.md`: five actions, context sent, no execution, secret gate, provider failures; distinguish `fix-message` from the legacy correction button behaviour.
- Update `docs/11` (new channels `ai:compose`/`ai:action`, session environment fields), `docs/12` (manual: AI button, modal, Use/Cancel/Close, environment line), `docs/19` (provider prerequisites for the actions, cost/timeout note), `docs/24` (input matrix: modal focus, Escape, insertion).
- Add a capture scenario for the modal (test-mode provider) and refresh the affected documentation screenshots; keep the existing scenario set green and avoid committing nondeterministic images.
- Update `docs/13` security checklist with the secret-before-provider rule and the "never persist prompt/answer" invariant.
- Keep English copy and M20 tokens; run `test:docs-links`, `test:install-docs`, `test:doc-consistency`.

## Acceptance
- Documentation matches the implementation, with no claim the tests do not support.
- Screenshot scenario renders deterministically and is referenced by the update note.
- Documentation checks pass; no runtime change beyond the capture scenario.
