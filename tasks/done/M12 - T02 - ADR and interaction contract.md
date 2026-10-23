---
title: "M12 - T02 - ADR and interaction contract"
type: task
project: smart-terminal
created: 2026-10-23
id: "M12-T02"
milestone: "M12"
depends_on: "M12-T01"
deliverables: "ADR selecting the interaction model and defining the keyboard/focus/AI/history contract"
---
<!-- gsynchro:v1 id=26966836-77f8-4139-adf9-f7fe92aab318 registered=2026-10-23T20:20:48.267Z -->

# M12 - T02 - ADR and interaction contract

## Objective
Record the definitive choice and the exact behavior a future implementation must follow.

## Constrained implementation
Create `docs/23 - ADR assisted input and terminal keyboard behavior.md` with:
- Status: proposed, pending user approval; date; context.
- Decision: Option B — keep both surfaces; terminal PTY keys untouched; assisted input is a command composer.
- Rejection of A/C and the technical reason: shell buffer, raw mode, TUI, SSH, paste/readline, AI review safety.
- Key contract: terminal ownership; input ArrowUp/Down caret movement; Tab focus traversal (not completion); Enter sends; Shift+Enter newline; IME; Escape; paste; no second history; app history only for assisted sends; AI explicit/reviewable; STT appends.
- Focus contract: explicit transition, no key stealing; future shortcut/UX to be specified.
- Consequences and future test plan: terminal passthrough local/SSH/TUI, input multiline/caret/Tab/IME, AI review, STT, draft/history, accessibility.
- Explicit non-goals and conditions that would reopen the decision.

## Acceptance criteria
- Decision is unambiguous and actionable.
- It states what is accepted and rejected, not an open menu.
- It defines future tests without implementing them.
- No code or behavior change.

## References
docs/24; docs/05; docs/08; docs/12; docs/14.

## Do not
Do not add terminal Enter interception or change the app.
