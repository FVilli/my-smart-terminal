
## Outcome
- Added `InstallationStore` (`userData/installation.md`, stable UUID) and `InstanceRegistrar` writing `instances/<machine>-<installation-id>.md`.
- Extended Git scope to `sessions/` + `instances/`; explicit `testRemote` path-scoped commit/push, no force/autostash, dirty-outside refusal, local-only mode, push/offline failure keeps local commit.
- Added `setup:test-remote` IPC/API, wizard “Test repository” with result/retry, tests (bare remote, repeat, offline, dirty outside) and `test:remote-setup-smoke`.
- Verified remote file exists in the bare repository; 392 tests and remote smoke green. Docs/03, docs/04, docs/10, docs/11, docs/13 and docs/16 ADR updated.
