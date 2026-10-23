---
title: "Repository setup guide"
type: guide
project: smart-terminal
created: 2026-10-23
---
<!-- gsynchro:v1 id=f78f9f2f-50b0-4367-873b-66827aaf7caa registered=2026-10-23T13:00:27.389Z -->

# Repository setup guide

![Initial setup, step 1: machine name, data repository, optional Git remote](assets/screenshots/01-onboarding.png)

## What you configure

- **Machine name**: a short name without slashes, unique per computer. It is used in session folders, filters and the instance registration.
- **Data repository**: an absolute path to a local directory or Git working tree. Smart Terminal creates `sessions/` and `instances/` inside it.
- **Git remote (optional)**: an SSH or HTTPS remote that the local Git client can access. Credentials stay in the system Git credential helper/SSH agent, not in Smart Terminal or Markdown.

## Test the repository

Click **Test repository**. Smart Terminal:

1. initializes the data repository and Git metadata when needed;
2. fetches and integrates the remote when reachable;
3. writes a non-sensitive `instances/<machine>-<installation-id>.md` file;
4. creates a path-scoped commit containing only `sessions/` and `instances/`;
5. pushes to the configured remote without force.

A successful result shows the short commit hash and confirms the push. The instance file contains the installation UUID, machine name, app version, platform, architecture and timestamps only. It never contains usernames, home paths, network hostnames, tokens or secrets.

## What happens when something fails

| Result | Meaning | Action |
| --- | --- | --- |
| **Repository verified: commit … pushed** | Commit and push succeeded. | Continue setup. |
| **Repository verified locally; no remote configured** | Local-only commit. | Add a remote later in Settings, then retest. |
| **Push failed / offline** | The local commit was kept; the next sync may push it. | Fix network/credentials and click **Test repository** again. |
| **Tracked changes outside sessions/ and instances/** | The repository has unrelated uncommitted changes. | Commit or discard them outside Smart Terminal, then retest. |
| **Invalid path/remote** | The input is not an absolute path or a valid remote. | Correct the field and retest. |

The test is explicit: it never runs automatically when you click Save. You can skip it and continue; the terminal remains usable, and sync can be configured later in Settings.

## Recommended Git layout

- Keep the data repository separate from your source-code repositories.
- Use a private remote; session Markdown may contain commands and cwd values.
- Credentials are handled by the system SSH agent or Git credential helper.
- Do not force-push the data repository.
- Back up the remote and the local clone before changing machines.

## Settings later

Open the gear icon in the header to reopen the wizard. Repository, machine and remote changes require an app restart; AI/STT changes apply immediately. Use **Cancel** or Escape to leave without saving; unsaved changes prompt for confirmation.
