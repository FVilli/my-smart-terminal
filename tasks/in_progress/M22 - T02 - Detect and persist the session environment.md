---
title: "M22 - T02 - Detect and persist the session environment"
type: task
project: smart-terminal
created: 2026-10-25
id: "M22-T02"
milestone: "M22"
depends_on: "M22-T01"
deliverables: "OS/shell detection for local and SSH sessions, persisted in session.md and exposed to the renderer"
---

# M22 - T02 - Detect and persist the session environment

## Objective
Give every session a reliable, persisted OS/shell context that the AI modal can use, without blocking terminal input.

## Implementation
- Extend the session Markdown schema additively: optional `os`, `shell`, `env_source`, `env_detected_at` fields validated when present, preserved when unknown (`packages/data/src/schema.ts`, add to `SESSION_KEYS` and `SessionMeta`, keep `schema_version: 1`). Round-trip tests for present/absent/unknown values.
- Local sessions: derive `os` from `process.platform` and `shell` from the resolved shell command in `packages/terminal` (`buildLocalShellCommand`); record them when `session.md` is created (no PTY output, no extra process).
- SSH sessions: add one non-interactive probe (`ssh -o BatchMode=yes -o ConnectTimeout=3 <alias> 'printf "%s;%s" "$(uname -s)" "$SHELL"'`) with a hard timeout, executed independently of the interactive PTY; map `Linux/Darwin/…` and `bash/zsh/fish/pwsh` to the contract enums; any failure records `unknown` and never surfaces as a terminal error.
- Contracts: extend `TerminalSessionInfo` (and the session view model) with an optional environment object `{ os, shell, source, detectedAt }`; keep the payload optional so older session files still parse.
- Renderer: expose the environment through the sessions store for the modal and status display; no polling.
- Probe design must be injectable/testable (command builder + runner seam); tests cover success, timeout, non-zero exit, unparsable output and local mapping.
- Add invariant comments (why the probe never uses the interactive PTY, why failure is silent) per `docs/31`.

## Acceptance
- Local sessions always have OS/shell persisted; SSH sessions have `unknown` or detected values with `env_source` and timestamp.
- Existing sessions without the fields keep loading and syncing; no schema_version bump or destructive migration.
- Detection never delays session creation and never writes to the terminal.
- Unit tests, typecheck and lint pass; docs/11 updated if the session payload is documented there.
