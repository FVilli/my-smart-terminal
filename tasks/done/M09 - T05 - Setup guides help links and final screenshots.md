---
title: "M09 - T05 - Setup guides, help links and final screenshots"
type: task
project: smart-terminal
created: 2026-10-23
id: "M09-T05"
milestone: "M09"
depends_on: "T02,T03,T04,M08-T04"
deliverables: "Setup guides, help links and final screenshots"
---
<!-- gsynchro:v1 id=1581d544-3e01-4755-8322-eab05ce58eca registered=2026-10-23T12:22:28.376Z -->

# M09 - T05 - Setup guides, help links and final screenshots

## Objective
Document every setup screen with real screenshots and make the guides reachable from the app and GitHub.

## Constrained implementation
Create/extend English setup documentation for repository/remote, AI provider and STT with real screenshots of the final wizard; include exact UI labels, expected results, failure recovery and privacy notes. Add a closed `help:open` enum and a main-process API that maps fixed keys to fixed GitHub documentation URLs (`shell.openExternal` only for that whitelist). Add a Markdown link checker to CI. Link the guides from README, docs/12 and docs/14. Refresh the screenshot gallery after M08/M09 final UI. Verify all links resolve.

## Acceptance criteria
Every setup step has a linked guide and a screenshot matching the shipped UI; help links open the expected GitHub docs; no arbitrary URL can be opened from the renderer; README/manual/onboarding guides cross-link; link checker passes in CI; screenshots captured on Xvfb.

## References
docs/12; docs/14; docs/assets/screenshots; README.md; apps/renderer/src/app/onboarding.

## Do not
Do not expose arbitrary external URL opening or include personal data/tokens in screenshots.

## Outcome
- Added repository and AI setup guides (`docs/18`, `docs/19`) and completed the STT guide (`docs/17`); screenshots for wizard steps 1-3 added.
- Added closed `help:open` IPC/API with fixed GitHub documentation URLs and in-wizard links for all three setup paths.
- Refreshed all real screenshots after the final M08/M09 UI; added `scripts/check-links.mjs` (`test:docs-links`) and CI link check.
- README/manual/onboarding guide cross-link the guides.
