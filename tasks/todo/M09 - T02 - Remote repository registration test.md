---
title: "M09 - T02 - Remote repository registration test"
type: task
project: smart-terminal
created: 2026-10-23
id: "M09-T02"
milestone: "M09"
depends_on: "T01"
deliverables: "Remote repository registration test"
---
<!-- gsynchro:v1 id=4d688779-c044-447a-ad7d-ce0953a0f021 registered=2026-10-23T12:22:28.374Z -->

# M09 - T02 - Remote repository registration test

## Objective
Prove during setup that the configured data repository can commit and push, by registering the installation in Markdown.

## Constrained implementation
Add a setup action that writes `instances/<machine>-<installation-id>.md` (schema_version, instance_id, machine, app_version, platform/arch, created_at/updated_at; no usernames, paths, tokens or secrets), stages only the allowed instance/session paths, creates a real commit and pushes to the configured remote. Make it idempotent and safe: no force push, no mutation of unrelated files, local-only mode when no remote, actionable errors for auth/offline/rejected push, and a retry path. Extend Git staging/commit scope and docs from sessions-only to sessions+instances. Show commit hash/push result in the wizard. Tests must use a local bare remote and verify the file exists remotely.

## Acceptance criteria
On a valid remote the file is visible in the remote repository after setup; repeated runs update without duplicate commits; no secrets are written; failures leave a recoverable state with a clear message; local-only and offline modes are handled; Git tests cover commit/push/rejection/auth failure; docs/03 and docs/04 are updated.

## References
docs/03; docs/04; docs/10; packages/sync; apps/desktop/src/main/onboarding-service.ts.

## Do not
Do not force-push, stage unrelated files, or store credentials in the repository.
