---
title: "M10 - T04 - Cross-guide integration and verification"
type: task
project: smart-terminal
created: 2026-10-23
id: "M10-T04"
milestone: "M10"
depends_on: "M10-T01, M10-T02, M10-T03"
deliverables: "Cross-guide cleanup, README verification, link/script checks and independent review"
---
<!-- gsynchro:v1 id=d8d38de6-851b-4a4e-9fc4-82b909a9eb34 registered=2026-10-23T13:29:31.214Z -->

# M10 - T04 - Cross-guide integration and verification

## Objective
Make the three guides one coherent, verified installation experience and remove conflicting/stale instructions elsewhere.

## Constrained implementation
- Update README's documentation list and manual/onboarding install references so the OS guides are authoritative; remove duplicated or stale install steps/filenames.
- Add cross-links between the three guides and the onboarding/repository guides.
- Add a focused automated check for README's exactly-three installation links, stale artifact/userData paths, and English-only guide content if practical without new dependencies.
- Run `npm run test:docs-links`, extract and `bash -n` Linux/macOS code blocks, and verify no secrets.
- Obtain independent reviewer approval for non-expert clarity/safety and evidence-auditor approval for platform claims; apply fixes and record residual caveats.

## Acceptance criteria
- README installation section contains exactly the three specified links.
- No duplicate install instructions or stale `My-Smart-Terminal.AppImage` / `~/.config/Smart Terminal` references remain.
- All local links resolve; scripts are syntax-valid and non-destructive; guides cover install, launch, update, uninstall, data separation, recovery.
- Reviewer and evidence-auditor reports are addressed; no app/release changes.

## References
All three new guides; README; docs/12; docs/14; docs/17-19; docs/WORKFLOW.md.

## Do not
Do not publish a release or change app behavior for a docs-only milestone.

## Outcome
- README installation section has exactly the three OS guide links; all guides added to the documentation index. `docs/12` and `docs/14` now delegate installation to the guides and the stale `My-Smart-Terminal.AppImage` reference is gone.
- Added Windows/Linux/macOS cross-links and `scripts/verify-installation-docs.mjs` + `test:install-docs` (README link count, stale-path/artifact checks, required concepts, unsafe-command ban, bash syntax). CI runs it after the Markdown link check.
- Verification: `test:docs-links` and `test:install-docs` pass; unit tests and lint pass.
- Independent reviewer approved the first cut; evidence audit found the real `.deb` package name is `my-smart-terminal`, not `smart-terminal`. Corrected the uninstall command and added a regression check.
- Evidence audit also flagged outdated macOS right-click-first guidance; changed the primary path to System Settings > Privacy & Security > Open Anyway (Apple support 102445), keeping right-click as an older-macOS fallback and avoiding a damaged-app re-download loop.
- Final independent delegate review APPROVED; the configured gemma reviewer returned empty/truncated output twice (model failure, not repo failure).
- Residual risks: Windows NSIS folder/uninstaller wording and macOS first launch were not manually executed on those OSes; checks validate documentation/links, not real installs.
- Incident: `gsynchro` restarted during the milestone and overwrote `package.json`; it was stopped, the file restored from `HEAD~1`, and the daemon was left stopped.
