---
title: "Input interaction matrix"
type: reference
project: smart-terminal
created: 2026-10-23
---
<!-- gsynchro:v1 id=c760b2ac-c6f1-4ffb-a1e8-dc11388de171 registered=2026-10-23T20:20:48.252Z -->

# Input interaction matrix

This reference records the implemented interaction surfaces and the alternatives considered by M12. It is evidence-neutral: it does not recommend an option.

## Current behavior and evidence

| Surface or behavior | Current behavior | Evidence |
| --- | --- | --- |
| Assisted input: Enter | Enter submits the non-empty draft; the keydown handler prevents the browser default. A successful PTY write clears the draft. | `apps/renderer/src/app/assisted-input/assisted-input.ts`; `apps/renderer/src/app/sessions-store.ts` |
| Assisted input: Shift+Enter | Shift+Enter is not submitted by the keydown handler and remains a textarea newline. | `apps/renderer/src/app/assisted-input/assisted-input.ts` |
| IME | Enter while composing (`isComposing` or keyCode 229) is not submitted. | `apps/renderer/src/app/assisted-input/assisted-input.ts` |
| Caret and navigation | The control is a native multiline `textarea`; caret movement, including multiline movement, is owned by the browser/editor. There is no application ArrowUp/ArrowDown history handler. | `apps/renderer/src/app/assisted-input/assisted-input.ts` |
| Tab and Escape in input | There are no application Tab, Escape, Ctrl-key, or arrow handlers in the assisted-input component. Tab therefore follows normal focus behavior; Escape does not clear the draft. | `apps/renderer/src/app/assisted-input/assisted-input.ts` |
| Drafts | Drafts are held in memory per session/tab and removed when that tab closes. Switching tabs preserves them. | `apps/renderer/src/app/sessions-store.ts`; `docs/08 - UX and interactions.md` |
| Explicit AI review | Clicking AI requests correction for the editable draft. A changed result replaces the draft and displays a review notice; it is never submitted automatically. Shell-like text may be skipped. | `apps/renderer/src/app/assisted-input/assisted-input.ts`; `apps/renderer/src/app/ai/ai-store.ts`; `docs/05 - AI, voice and security.md` |
| STT | Voice transcription is appended to the draft. It does not send the draft automatically. | `apps/renderer/src/app/assisted-input/assisted-input.ts`; `docs/05 - AI, voice and security.md` |
| Assisted history | After a successful assisted-editor PTY write, the text is eligible for asynchronous history with source `assisted`; filtering can reject it and a history failure does not undo the PTY write. Sensitive text can be rejected by the history service. | `apps/renderer/src/app/sessions-store.ts`; `apps/desktop/src/main/history-service.ts` |
| Terminal input | xterm `onData` forwards data to `writeTerminal`; the app adds no interpretation or rewriting. Browser/xterm translation and paste handling occur before `onData`. The renderer does not interpret prompt state, raw mode, or application state. | `apps/renderer/src/app/terminal-panel.ts` |
| xterm ownership | When the terminal surface is active, the PTY receives the bytes for arrows, Tab, Enter, paste, Escape, and Ctrl keys. Shell/readline or a TUI owns their meaning. This same path serves local and SSH sessions. | `apps/renderer/src/app/terminal-panel.ts`; `apps/renderer/src/app/sessions-store.ts` |
| Focus on tab activation | Activating a terminal panel fits it and focuses xterm. | `apps/renderer/src/app/terminal-panel.ts` |
| Native shell history | Native shell history is separate from app history and is not generally captured by the app. | `docs/12 - User manual.md`; `docs/14 - Post-install onboarding.md` |

## Scenario matrix

“Unchanged” means the existing terminal or input ownership remains intact; it does not prescribe an implementation change.

| Scenario | Active surface | Current behavior | Desired / unchanged | Risk if intercepted |
| --- | --- | --- | --- | --- |
| Single command | Assisted input or terminal | Input Enter submits the draft; terminal Enter reaches the PTY. | Preserve deliberate assisted submission and direct PTY entry. | A terminal interceptor could submit an incomplete or differently edited shell buffer. |
| Multiline command/text | Assisted input | Shift+Enter creates a textarea newline; the draft can be reviewed before sending. | Preserve multiline editing and explicit send. | Converting terminal Enter could confuse line breaks with shell execution or alter paste content. |
| AI correction | Assisted input | AI is invoked by explicit button click, replaces a changed draft, and requires review. | Keep AI explicit and reviewable. | Automatic interception would make AI activation implicit and could send unreviewed text. |
| STT | Assisted input | Transcription appends to the editable draft without sending. | Preserve append-without-send. | An intercepted Enter or automatic path could submit incomplete transcription. |
| ArrowUp / ArrowDown | Terminal or input | Terminal bytes reach shell/readline/TUI; input arrows move the native textarea caret. | Keep ownership with the active surface; no app history recall from input arrows. | App-level history could steal shell history or move a multiline caret unexpectedly. |
| Tab | Terminal or input | Terminal Tab reaches shell/readline/TUI; input Tab follows focus traversal. | Preserve completion in the terminal and normal accessibility traversal in input. | Interception breaks completion or traps keyboard focus. |
| Escape | Terminal or input | Terminal Escape reaches the PTY; input has no clear-draft Escape handler. | Preserve terminal escape sequences and draft contents. | Clearing or consuming Escape can cancel TUI modes or destroy an editable draft. |
| Paste | Terminal or input | xterm receives terminal paste data; textarea receives normal browser paste. | Preserve terminal bracketed-paste/application handling and normal input paste. | Reconstructing or rewriting paste loses delimiters, control data, or bracketed-paste semantics. |
| Shell history | Terminal | Native shell/readline history remains in the shell/PTY. Assisted submissions are separately recorded by the app. | Keep the two existing sources distinct; no third history. | A bridge can duplicate, reorder, or misattribute history. |
| TUI (`vim`, `htop`) | Terminal | TUI receives raw/application keys through the PTY. | Leave TUI keyboard behavior untouched. | Enter interception can corrupt modes, commands, navigation, or redraw protocols. |
| SSH | Terminal | SSH uses the same xterm-to-session write path; the remote endpoint interprets the bytes. | Preserve remote shell and application behavior. | The local app cannot reliably observe remote prompt, line buffer, raw mode, or TUI state. |
| IME | Assisted input | Composition Enter does not submit. | Preserve composition-safe behavior. | Interception can submit before composition commits or lose composed text. |
| Focus change | Either surface | Terminal tab activation focuses xterm; drafts remain per tab. | Make transitions explicit and do not steal keys from the focused surface. | Implicit focus changes can route commands to the wrong PTY or consume the first key. |

## Options comparison

| Option | User value | PTY / TUI compatibility | AI safety | History | Accessibility | Implementation / maintenance risk |
| --- | --- | --- | --- | --- | --- | --- |
| A — remove assisted input and intercept terminal Enter | One surface and potentially convenient correction at Enter. | Low: must infer shell state and can disrupt readline, raw mode, TUI, paste, local, and SSH behavior. | Low to mixed: Enter-based automation can bypass explicit review. | Risks conflating native shell history with app history or losing assisted-only provenance. | Fewer surfaces, but interception can violate terminal and keyboard expectations. | High: shell-, terminal-, and remote-state inference is brittle and broad in scope. |
| B — keep assisted input with a key contract | Multiline composer, explicit AI review, STT, and per-tab drafts alongside a real terminal. | High when the app adds no key rewriting; input behavior is scoped to the textarea. | High: AI is explicit, editable, and never automatic. | Keeps assisted app history separate from native shell history. | Native caret and focus traversal are retained; two explicit surfaces must be understandable. | Moderate: two surfaces require a clear focus contract, but no PTY emulation. |
| C — hybrid terminal/input bridge | May offer a single workflow with selective assistance. | Mixed: safe routing requires reliable prompt/raw/TUI detection that is unavailable for local and remote applications. | Mixed: review may be bypassed in some routes or duplicated in others. | Risks duplicate or inconsistent histories across bridge and shell. | Potentially convenient, but routing and focus rules are difficult to explain and operate. | High: ongoing protocol, shell, paste, SSH, and TUI compatibility maintenance. |

## Technical finding

Terminal Enter interception cannot reliably know the shell line buffer, whether a process is in raw mode, whether a TUI is active, or the state of a remote application. Reconstructing a line from keystrokes fails with cursor editing, deletion, multiline input, bracketed paste, readline behavior, and TUI protocols. SSH makes the authoritative state remote. Shell integration could expose some prompt or command information, but it would be shell-specific, optional, and incomplete; it cannot provide a general contract for arbitrary shells, programs, TUIs, or remote sessions.

This finding explains the compatibility and maintenance risks in the comparison. It does not select an option; the decision is recorded separately in the ADR [23 — ADR assisted input and terminal keyboard behavior](23%20-%20ADR%20assisted%20input%20and%20terminal%20keyboard%20behavior.md).

## References

- [AI, voice, and security](05%20-%20AI%2C%20voice%20and%20security.md)
- [UX and interactions](08%20-%20UX%20and%20interactions.md)
- [User manual](12%20-%20User%20manual.md)
- [Post-install onboarding](14%20-%20Post-install%20onboarding.md)
- [ADR: assisted input and terminal keyboard behavior](23%20-%20ADR%20assisted%20input%20and%20terminal%20keyboard%20behavior.md)
