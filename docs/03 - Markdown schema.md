---
title: "Markdown contract"
type: spec
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=c43eea1f-0202-4303-8175-cee41950769b registered=2026-10-23T07:57:44.707Z -->

# Markdown contract

## Path
`sessions/<machine>/YYYY-MM-DD_HH.mm_S<n>_<local|ssh-alias>/{history,clipboard,session}.md`. Local timestamp in the ID; `S<n>` is sequential per machine, allocated atomically and never reused. `machine` is normalized without slashes. Sessions from multiple windows share the counter.

## Common frontmatter
`schema_version: 1`, `session_id`, `machine`, `created_at` in ISO 8601 with timezone; `kind` in metadata. Events have unique IDs and timestamps for deduplication.

## history.md
Sections `## <ISO8601> · <event-id>` with `source: shell|assisted`, `agent: ...`, `cwd: ...` fields and a fenced `text` block containing the input. Record shell input only with reliable integration; record TUI prompts only when sent through the assisted editor. Do not record passwords or secret input.

## clipboard.md
Event sections with timestamp, `text` type, source when available, and a fenced block. Deduplicate by hash within the session, with blacklist and size limits. Do not capture sensitive clipboard content; configurable disabling.

## session.md
Frontmatter with `session_id`, `machine`, `window_id`, `kind`, optional `ssh_alias`, `cwd_initial`, `started_at`, and `ended_at` when closed. State can be derived; no continuous heartbeat updates.

## Concurrent access
Only the session owner modifies its three files; the coordinator assigns IDs and serializes Git operations. Markdown is readable and versioned; no persistent database.

## `S<n>` counter
- `sessions/<machine>/counter.md` is versioned metadata in the data repository (not a session file): frontmatter `schema_version`, `machine`, `last_session`, `updated_at`.
- Allocation occurs under the primary's lock (`userData/coordinator/`, atomic `mkdir`, PID/nonce/heartbeat) and reserves the ID **before** returning it; gaps after a crash are acceptable, reuse is not.
- Bootstrap or invalid counter: rebuild from the maximum `S<n>` in existing directories, then resume from the next one.
- In M03 the allocator is a service behind an interface; M04 exposes it through the primary without introducing a second lock.

## MVP history coverage
- M03 records assisted-editor submissions (`source: assisted`).
- Native shell history is not covered in the MVP: no injection into `.bashrc`/`.zshrc`/startup, no keystroke or TUI prompt interception. An existing OSC integration may be accepted only if verified and reliable.
- Explicit deviation from M03-T03, to be retained in the release notes.
