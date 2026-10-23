---
title: Runtime logic and states
project: smart-terminal
type: architecture
version: 1
created: 2026-10-22
---
<!-- gsynchro:v1 id=a2a5d44f-2779-46ee-b847-04365a633dde registered=2026-10-23T07:57:47.694Z -->
# Runtime logic

## Startup
1. Start an Electron window without a global single-instance lock.
2. Connect to the local coordinator via IPC; if absent, attempt primary election with an OS lock and owner verification.
3. The primary opens the data clone, initializes the per-machine counter, Markdown index, and GitSyncManager.
4. Each window creates its own PTYs, local or `ssh <alias>` through OpenSSH.
5. The UI subscribes to session, history, clipboard, sync, and primary events.

## Session
New tab -> request an atomic ID from the coordinator -> create `sessions/<hostname>/YYYY-MM-DD_HH.mm_S<n>_<local|ssh-host>/` -> initialize `session.md`, `history.md`, `clipboard.md` with frontmatter -> start the PTY. Each session has a separate input draft. Switching tabs does not terminate the process. Closing a tab: confirm if active, terminate the PTY cleanly, update `session.md`, and schedule sync.

## Events and capture
Markdown writes are immediate and atomic (tmp + rename where applicable). Native history is captured through shell integration when available; agent prompts use a verified assisted editor or adapter. Do not interpret TUI keystrokes as prompts. Clipboard is detected per service instance, deduplicated, and filtered; do not capture recognized secrets and allow pause/clear.

## Primary
The primary role is local to the machine: one write coordinator per clone and counter. After a crash: recoverable lock, new election, and folder rescan before assigning IDs. The UI indicator shows primary/non-primary and grants no extra privileges to the renderer.

## Sync states
`synced`, `dirty`, `syncing`, `offline`, `error`. Dirty after a local write; debounce push 10 s and maximum 60 s with continuous activity; fetch every 15 s. If a push is rejected: fetch, rebase, and limited retry with backoff. Never force-push; on conflicts, stop sync, preserve files, and show an error. Remote history becomes visible after commit integration.
