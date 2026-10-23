---
title: "ADR - Instance registration and setup verification"
type: adr
project: smart-terminal
version: 1
created: 2026-10-23
---
<!-- gsynchro:v1 id=d50dd87a-28b6-4a43-823c-cb6cc7067cd1 registered=2026-10-23T13:00:27.388Z -->

# ADR - Instance registration and setup verification

## Status
Accepted for M09.

## Context
Setup must prove that the configured data repository can commit and push, without storing credentials or personal paths in synchronized Markdown. The repository already uses `sessions/` for session data.

## Decisions
- Add `instances/<machine>-<installation-id>.md` to the data repository. It contains `schema_version`, `instance_id`, `machine`, `app_version`, `platform`, `arch`, `created_at`, `updated_at` and a short body; no usernames, home paths, network hostnames, tokens or secrets.
- Store the stable UUID in local `userData/installation.md` (`schema_version`, `installation_id`, `created_at`). It is not synchronized, so copying `config.md` cannot duplicate the installation identity.
- Extend the Git synchronization scope from `sessions/` to `sessions/` + `instances/`. All other paths remain untouchable; no force push and no autostash.
- The setup action is explicit (“Test repository”), not automatic on save. It performs fetch/integration before writing when possible, a path-scoped commit, and a push. If the push fails, the local commit is kept and the UI reports a recoverable error with Retry; the next `syncOnce` may push it. With no remote, the result is local-only.
- Refuse to proceed when tracked changes outside `sessions/`/`instances/` exist, with an actionable message.
- Repeating the test updates `updated_at` at most once per action and does not create duplicate files.

## Consequences
- Setup gives real feedback about authentication and remote permissions.
- The data repository now contains a small amount of installation metadata besides sessions; docs/03 and docs/04 are updated.
- A failed registration leaves one local commit by design; users can retry or let normal sync push it.
- Tests use a local bare remote and never require real credentials.

## References
docs/03 - Markdown schema.md; docs/04 - Sync Git.md; docs/10 - Local config, coordinator and runtime security.md; docs/13 - Security checklist.md.
