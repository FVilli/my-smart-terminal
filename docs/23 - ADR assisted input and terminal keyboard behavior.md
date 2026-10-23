---
title: "ADR: assisted input and terminal keyboard behavior"
type: adr
project: smart-terminal
created: 2026-10-23
status: accepted
---
<!-- gsynchro:v1 id=907f3f78-02d6-4ba6-be00-e900738f25d6 registered=2026-10-23T20:20:48.251Z -->

# ADR: assisted input and terminal keyboard behavior

**Status:** Accepted — approved by the user on 2026-10-23  
**Date:** 2026-10-23

## Context

Smart Terminal has two input surfaces: a real xterm-backed PTY and an assisted-input textarea. The terminal is used for local shells, SSH sessions, and interactive programs such as `vim` and `htop`. The assisted input provides multiline drafting, explicit AI review, speech-to-text (STT), and a separate in-memory draft per tab.

The current terminal path forwards xterm `onData` bytes to the session without prompt or mode interpretation. The assisted input handles Enter, Shift+Enter, IME composition, explicit AI correction, and STT independently. Assisted submissions are recorded with source `assisted`; native shell history remains native. See the [input interaction matrix](24%20-%20Input%20interaction%20matrix.md) for evidence and scenario analysis.

Intercepting terminal Enter would require knowing the shell's current line buffer and whether the process is in cooked mode, raw mode, a TUI, or a remote application. Those facts are not reliably available to the renderer. Cursor editing, deletion, multiline input, bracketed paste, readline, TUI protocols, and SSH make keystroke reconstruction incomplete and unsafe.

## Decision

Choose **Option B: keep the assisted input and preserve the terminal as a real PTY**. The assisted input is a command composer for multiline text, explicit AI review, and STT. The terminal remains a direct interactive surface. This decision changes no current application behavior; it defines the contract for future implementation and review.

### Terminal ownership and input contract

When the terminal surface is active:

- The app adds no application-level key interception, interpretation, or rewriting; xterm emits data through `onData` to the session as it does today.
- The shell, readline, TUI, or remote application owns the meaning of those bytes. Browser/xterm translation and paste handling still occur before `onData`; the contract is “no app-level rewriting”, not physical-key or byte-for-byte identity.
- Local and SSH sessions use the same pass-through ownership model.

When the assisted input is active:

- ArrowUp/ArrowDown move the textarea caret, including within multiline drafts; they do not recall app history.
- Tab is normal focus traversal, not shell completion and not an inserted terminal tab.
- Enter sends the non-empty draft.
- Shift+Enter inserts a newline.
- Enter during IME composition does not send.
- Escape does not clear the draft.
- Paste remains normal textarea paste.

### Focus transition contract

- Clicking a surface focuses that surface. Activating a session tab focuses the terminal, as today.
- `Ctrl+Shift+E` on Linux/Windows (or `Cmd+Shift+E` on macOS) focuses the assisted input without clearing its draft.
- When the assisted input is focused and IME/menu handling is not active, `Escape` returns focus to the terminal and preserves the draft.
- The shortcut must be discoverable in the UI/help, keyboard-accessible, and must not fire while the terminal is focused; terminal keys remain owned by the PTY.
- After a successful send from the input, focus remains on the input so the next command can be composed; moving to the terminal is explicit.
- Focus is always visible. Tab from the input follows the normal control order (including the AI, microphone and send controls); it never inserts a tab character or traps focus.
- `docs/08` must be updated to state the then-current newline and focus behavior when implementation lands; it must not document a shortcut before it exists.

### AI, STT, drafts, and history

- AI correction is explicit and reviewable. It is never invoked automatically by terminal Enter or assisted-input Enter, and a correction is never sent without user review.
- STT appends its transcription to the draft without sending it.
- Drafts remain in memory per tab.
- A successful assisted send is eligible for app history. Recording is asynchronous; existing validation/privacy filtering can reject text and a history failure can mean no entry, while the PTY write remains successful.
- Native shell history stays native to the shell/PTY.
- There is no third history assembled by intercepting or mirroring terminal keystrokes.

## Amendment 2026-10-23: application zoom shortcuts

The user requires working application zoom. As a narrow exception to the PTY ownership rule, the app may intercept **only** `Ctrl/Cmd+-`, `Ctrl/Cmd++` (including `Ctrl+=`, `Ctrl+Shift+=` and numpad plus) and `Ctrl/Cmd+0` for zoom out/in/reset, even while xterm has focus. All other Ctrl keys remain PTY-owned. This is not a general key-interception layer. Applications that themselves use those combinations lose those specific keys; this limitation must be documented in the zoom help/UI.

## Rejected alternatives

### Option A — remove assisted input and intercept terminal Enter

Rejected because the terminal app cannot reliably observe the shell line buffer, cooked/raw mode, active TUI, or remote application state. Reconstructing commands from keystrokes fails with cursor movement, editing, readline, multiline input, bracketed paste, and TUI protocols. SSH places the authoritative state on the remote side. It would also remove the explicit editable AI-review boundary and risk conflating native shell history with app history. Enter interception could alter commands or interactive application behavior and is therefore not an acceptable security or compatibility boundary.

### Option C — hybrid terminal/input bridge

Rejected because selective interception still needs the same unavailable state: prompt detection, shell line-buffer knowledge, raw-mode detection, TUI identification, paste semantics, and SSH awareness. A bridge would create ambiguous ownership, duplicate or inconsistent histories, and routes where AI review is bypassed or repeated. Shell integration could improve a particular shell, but it would be shell-specific and incomplete rather than a reliable contract for arbitrary local, TUI, and remote sessions.

## Consequences

### Benefits

- Interactive shells, readline, TUIs, bracketed paste, and SSH retain direct PTY ownership.
- AI correction has a clear explicit-review boundary and cannot silently execute or submit a result.
- Multiline drafting, STT append, per-tab drafts, and assisted-only app history remain available.
- Native shell history and app history remain distinguishable and independently trustworthy.
- The implementation does not need to emulate shell or remote application state.

### Costs and trade-offs

- Users must understand the distinction between the terminal surface and the assisted composer.
- Focus transitions need an explicit, accessible UX and careful testing.
- Assisted app history does not replace native shell history.
- AI and STT remain optional workflows rather than transparent terminal-wide interception.

## Non-goals

- Removing the assisted input.
- Intercepting terminal Enter or other terminal keys.
- Reconstructing shell buffers, detecting arbitrary prompt/raw/TUI state, or adding shell-specific integration as a general solution.
- Creating a third history or mirroring terminal keystrokes into app history.
- Automatic AI correction, automatic AI submission, or automatic STT submission.
- Changing runtime behavior, release metadata, or application code as part of this ADR.

## Conditions that would reopen this decision

Reconsideration requires new evidence and explicit approval, such as a supported terminal integration contract that reliably exposes ownership for the target shell/application set, a new product requirement that outweighs PTY/TUI compatibility, or validated accessibility research showing that the two-surface model cannot be operated. A proposal must address local and SSH sessions, raw-mode TUIs, readline and cursor editing, bracketed paste, IME, AI review, history provenance, and failure behavior before changing this decision.

## Future implementation test plan

This is a test plan, not an implementation request.

- **Terminal passthrough:** verify that the app adds no rewriting to xterm `onData` for ArrowUp/Down, Tab, Enter, Escape, Ctrl keys, and bracketed paste, with expected PTY data for representative inputs in local shells, SSH sessions, and interactive `vim`/`htop`-style TUIs.
- **Input editing:** verify caret movement in single-line and multiline drafts, normal Tab focus traversal, normal paste, and Escape preserving the draft.
- **Submission:** verify Enter sends, Shift+Enter inserts a newline, successful-send draft clearing, failed-send retention, and IME composition Enter not sending.
- **AI review:** verify only explicit activation invokes AI, changed text replaces the editable draft, review is required, shell-like text can be skipped, and no Enter path invokes AI automatically.
- **STT:** verify transcription appends without sending, including repeated dictation and error/permission paths.
- **Drafts and history:** verify drafts remain isolated per tab, a successful send is eligible for asynchronous history (and may be filtered), failed sends are not recorded, native shell history remains native, and no third history appears.
- **Focus and accessibility:** assert that the documented shortcut focuses the input without clearing the draft; Escape returns to the terminal with the draft intact; clicking either surface matches focus; the first key after a transition reaches the intended surface; focus rings are visible; input Tab order is textarea → AI → mic → send (or the documented order); screen readers announce the focused control; no focus trap exists; and focus changes never steal a PTY key.
- **Compatibility and failure:** verify terminal usability when AI/STT are unavailable and preserve terminal behavior through resize, tab switching, reconnect/error, and process exit paths.

## References

- [Input interaction matrix](24%20-%20Input%20interaction%20matrix.md)
- [AI, voice, and security](05%20-%20AI%2C%20voice%20and%20security.md)
- [UX and interactions](08%20-%20UX%20and%20interactions.md)
- [User manual](12%20-%20User%20manual.md)
- [Post-install onboarding](14%20-%20Post-install%20onboarding.md)
