---
title: "Git synchronization"
type: spec
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=56a20afa-71a7-4266-a3d6-8bb7eb9ec0c1 registered=2026-10-23T07:57:45.482Z -->

# Git synchronization

## Ownership
One local data repository clone per machine. A single GitSyncManager in the coordinator owns Git access, with a mutex; all windows report dirty events to it through IPC. Never run Git in the user's project repository.

## Defaults
Immediate Markdown writes; debounce push 10 s from the last change, max wait 60 s; fetch every 15 s; synchronization at startup, after network recovery, and when a session closes. Configurable parameters.

## Algorithm
1. Schedule serialized operations. 2. Stage only `sessions/` and `instances/` (owned metadata). 3. Commit if there are changes. 4. Fetch origin. 5. Rebase/integrate; on conflict, preserve files and report an error without losing content. 6. Push; on non-fast-forward, repeat fetch/rebase/push with limited backoff. 7. Update the in-memory cache and notify windows.

## Semantics
Near-real-time, not guaranteed real-time. No force push. Offline: persistent local files and an implicit Git queue; do not block the shell. Private repository and secret sanitization before writing.

## Implementation (M04)
- `GitEngine` uses `execFile('git')` with `GIT_TERMINAL_PROMPT=0`, without a shell and without `--force`; mutating operations are serialized by a mutex.
- Init: `git init -b <branch>` if absent, local identity, `.gitignore` for temporary files; optional remote from `SMART_TERMINAL_GIT_REMOTE`, branch from `SMART_TERMINAL_GIT_BRANCH` (default `main`).
- Stage/commit only existing `sessions/` and `instances/` paths; other files are never staged. No empty commits.
- Fetch → rebase onto `origin/<branch>`; on conflict: `rebase --abort`, preserve files, state `error`. Push `HEAD:<branch>` with limited retry/backoff on non-fast-forward.
- Without a configured remote: local commits, no push; the UI must show "repository not configured" and must not block the terminal.
- Scheduler: debounce 10 s from the last dirty event, max wait 60 s from continuous activity, fetch every 15 s; only one sync/fetch at a time with coalescing. Periodic fetch uses `integrateRemote()`: if the tracked working tree is clean and the branch is behind, rebase onto `origin/<branch>` and update the index; no commit/push from fetch. With uncommitted tracked changes, integration is deferred to `syncOnce`. Parameters: `SMART_TERMINAL_SYNC_DEBOUNCE_MS`, `SMART_TERMINAL_SYNC_MAX_WAIT_MS`, `SMART_TERMINAL_SYNC_FETCH_INTERVAL_MS`. On stop/close, the manager attempts a flush with a 5 s timeout.
