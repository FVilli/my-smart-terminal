---
title: "M22 - T01 - Design the AI actions modal and prompt contract"
type: task
project: smart-terminal
created: 2026-10-25
id: "M22-T01"
milestone: "M22"
depends_on: "M21"
deliverables: "Approved design proposal for the AI actions modal, action semantics, prompt/system templates, states, copy and keyboard map"
---

# M22 - T01 - Design the AI actions modal and prompt contract

## Objective
Fix the UX and prompt contract before touching code, so later tasks do not invent product decisions.

## Implementation
- Read `docs/05`, `docs/11`, `docs/12`, `docs/19`, `docs/23`, `docs/24`, `docs/15`, the M20 styling conventions (`docs/28`, `docs/29`-`31`) and the current AI code (`packages/ai`, `apps/desktop/src/main/ai-service.ts`, `apps/renderer/src/app/ai/ai-store.ts`, the composer AI button).
- Write `docs/34 - M22 AI actions design proposal.md` with frontmatter (`title`, `type: design`, `project`, `created`) containing:
  - the five actions, their exact purpose and non-goals, and their user-facing copy (English);
  - modal anatomy using the M20 tokens (header with session context and provider status, action list, prompt textarea, Send, answer area, footer);
  - state machine: closed → open(idle) → composing → sending → answered | error | blocked; behaviour of Cancel/Close/Use in each state, and what survives reopening;
  - the fixed system instruction per action and the editable body template, with the delimiter rule for user text and the OS/shell context block;
  - what the AI receives (only action, prompt body, OS/shell; never tokens, files, history or clipboard) and what is never persisted;
  - selection rules for `Use` (caret insertion, multi-line, no selection = whole answer), focus trap/return, Escape, and screen-reader labels;
  - risk wording ("advisory, not a security control") for the assessment action;
  - explicit list of contract additions needed by T03 (`ai:compose`, `ai:action`) and environment fields needed by T02.
- Include a small textual wireframe and an ASCII/markdown layout diagram; no image dependency is required.

## Acceptance
- Design fixes every choice listed above with rationale; no open architectural question remains for T02–T07.
- The document names the exact actions, states, copy, keyboard behaviour and prompt/system separation.
- No runtime file changes.
