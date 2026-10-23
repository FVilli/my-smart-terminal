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
