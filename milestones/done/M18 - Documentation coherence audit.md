---
title: "M18 - Documentation coherence audit"
type: milestone
project: smart-terminal
created: 2026-10-24
id: "M18"
goal: "Audit and repair documentation after the 1.3.0 header/composer release, with a stable version-independent uninstall command and automated consistency checks. Documentation only."
depends_on: "M17B"
---

# M18 - Documentation coherence audit

## Scope
- Verify README, docs/08-27, install/uninstall guides, release notes, hotfix log and screenshots against the 1.3.0 code and current install scripts.
- Resolve versioning policy: install command pinned to the current release tag; uninstall command version-independent from `main` unless the user explicitly wants a tag.
- Update docs only; no app behavior changes and no release unless a code/script change becomes necessary.
- Add a lightweight documentation consistency check if practical.

## Acceptance
Every current command points to the right version/path; uninstall does not require the installed app version; current UI/header/composer/zoom/settings behavior is described coherently; historical version references are clearly historical; links and checks pass; independent review approves.
