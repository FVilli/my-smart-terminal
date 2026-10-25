---
title: "M22 - AI actions and session environment"
type: milestone
project: smart-terminal
created: 2026-10-25
id: "M22"
goal: "Turn the composer AI button into an action modal (suggest, explain, risk, fix, rewrite) that knows the session's OS and shell, and can insert the reviewed answer into the composer without ever executing it."
depends_on: "M21"
---

# M22 - AI actions and session environment

## Purpose
The terminal is where users decide what to run. Today the AI button only fixes typos in the assisted draft, and it knows nothing about the session it is helping with (local vs SSH, operating system, shell). M22 makes the AI a contextual assistant with five explicit actions, a reviewable prompt/answer flow, and an explicit hand-off into the composer.

## Product outcomes
1. **Suggest a command**: turn a described goal into a candidate command for the session's OS/shell.
2. **Explain a command**: explain what the typed command will do before it runs.
3. **Assess risk**: describe destructive/irreversible effects, required privileges, and safer alternatives.
4. **Fix a message**: remove typos from the message the user is about to send to an interactive agent, preserving code, paths, flags and meaning.
5. **Rewrite a dictated message**: turn a rough voice transcript into a clear message for the agent, without changing intent.

Every action runs only from the modal, only on explicit **Send**, and its answer reaches the composer only through **Use**. Nothing is executed, submitted or persisted automatically.

## Fixed decisions
- **One AI button, one modal.** The composer `[AI]` button opens a modal with the five actions. The current direct typo-correction click is replaced by the `fix-message` action; the underlying correction prompt stays in `packages/ai` and both paths share it.
- **Modal anatomy** (existing M20 tokens/utilities, no new visual language):
  - header: title, session context (`session label · os · shell`, or `unknown`), provider/model status;
  - action list: five radio-style options with one-line descriptions;
  - prompt textarea, prefilled from the selected action plus session context and the current draft (editable);
  - `[Send]` button bottom-right, disabled while the provider is unconfigured, the prompt is empty, or a request is running;
  - answer area below: read-only selectable text, with loading, error and timeout states;
  - footer: `[Cancel] [Use] [Close]`.
- **Footer semantics**: `Cancel` closes and discards prompt/answer; `Close` closes and keeps the prompt (so reopening restores it); `Use` inserts the selected part of the answer, or the whole answer when nothing is selected, into the composer at the caret, then closes. `Use` never submits the composer.
- **Selection is the unit of hand-off.** Partial selection inside the answer area is honored; multi-line answers are inserted verbatim.
- **No execution, no shadow terminal.** The AI never writes to the PTY, never runs a command, never changes the draft unless `Use` is pressed.
- **Session environment is first-class and persisted** in `session.md` so every later AI call is OS/shell-aware, including after restart and sync.
- **No new provider or dependency.** Reuse the existing Anthropic / OpenAI / OpenAI-compatible adapters and `safeStorage` token flow. One request per Send, no streaming in V1, timeout 15 s, `temperature: 0`.
- **Failure is non-blocking**: provider errors, timeouts and empty answers show in the modal and never affect the terminal, the draft or submission.
- **Privacy**: the prompt is sent to the configured provider only on explicit Send; known secret patterns are detected and blocked with an explicit warning; prompts/answers are never written to Markdown or logs.

## Session environment
- Persist in `session.md` frontmatter as additive optional fields of `schema_version: 1` (readers that do not know them must keep preserving them):
  `os` (`linux | macos | windows | unknown`), `shell` (`bash | zsh | fish | sh | pwsh | powershell | cmd | unknown`), `env_source` (`local | ssh-probe | unknown`), `env_detected_at` (ISO 8601).
- **Local sessions**: derive `os` from the main process platform and `shell` from the resolved shell command used to spawn the PTY (`buildLocalShellCommand`), recorded when the session is created — no extra probe, no PTY output.
- **SSH sessions**: run one non-interactive probe on session creation (`ssh -o BatchMode=yes -o ConnectTimeout=3 <alias> 'printf "%s;%s" "$(uname -s)" "$SHELL"'`), never through the interactive PTY, with a hard timeout and no retry. On any failure (auth prompt, host unreachable, unknown output) record `unknown`; the modal then states that context is unknown and the AI prompt asks for the missing detail instead of guessing. A manual "Detect again" action in the modal re-runs the probe for the current session.
- Detection never blocks or delays terminal input: the session opens immediately and the environment fields are filled when the probe returns.

## Non-goals
- No autonomous agent loop, command execution, shell integration or auto-completion inside the terminal.
- No local model runtime, new provider SDK, streaming UI, history of AI prompts/answers, or cloud conversation storage.
- No changes to PTY/xterm input semantics, Git/coordinator behavior, clipboard capture or STT.
- No redesign of the composer beyond the modal entry point and the existing insert-at-caret behavior.

## Security requirements
- Only main calls providers; renderer never sees tokens or provider bodies. Errors and diagnostics are sanitized (reason/category only).
- Validate every new IPC payload exactly (action id, bounded prompt length, optional selection metadata none), reject unknown fields, and keep the sender policy.
- Before sending, run the existing secret filter over the prompt; if it matches, block Send, explain why, and let the user edit the prompt.
- Prompt builders are fixed templates in `packages/ai`; user text is delimited and treated as data (instruction injection cannot change the action or bypass the "answer only" rule).
- Risk assessment is explicitly advisory ("heuristic, not a security control") in both prompt and UI.

## Acceptance
- All five actions exist, with prefilled prompts that include OS/shell context when known.
- Environment detection is persisted per session (local exact; SSH best-effort with `unknown` fallback), survives restart, and is shown in the modal.
- Modal flow works with keyboard and pointer; focus is trapped, Escape closes, focus returns to the composer trigger.
- `Use` inserts the selection or the full answer at the caret and does not send; `Cancel`/`Close` behave as defined; no automatic execution ever.
- Provider failures, timeouts, empty answers and secret-filter blocks are handled without blocking the terminal.
- New channel/contracts validated; unit tests, typecheck, lint, renderer build, Electron AI smoke and layout checks pass; docs updated.
- No new dependency, no PTY/Git/STT/data-format regression; M20 visual baseline preserved.

## Task sequence
T01 design and mock → T02 session environment detection and persistence → T03 AI actions contract and service → T04 modal UI → T05 use/apply and composer integration → T06 privacy, safety and failure modes → T07 documentation and screenshots → T08 verification and independent review.

T02 and T03 are independent after T01; T04 depends on both; T05–T07 are sequential; T08 closes the milestone.

## References
- `docs/05 - AI, voice and security.md`, `docs/19 - AI provider setup guide.md`
- `docs/11 - IPC contracts and runtime verification.md`, `docs/13 - Security checklist.md`
- `docs/23 - ADR assisted input and terminal keyboard behavior.md`, `docs/24 - Input interaction matrix.md`
- `docs/15 - Visual baseline.md`, `docs/28 - Renderer styling audit.md`, `docs/29 - Coding rules.md`, `docs/30 - Angular conventions.md`, `docs/31 - Comments and documentation policy.md`
- `mockups/Smart Terminal - final mock.png`, `docs/WORKFLOW.md`
