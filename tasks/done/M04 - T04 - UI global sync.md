---
title: "M04 - T04 - Global sync UI"
type: task
project: smart-terminal
created: 2026-10-22
id: "M04-T04"
milestone: "M04"
depends_on: "T03"
deliverables: "Global sync UI"
---
<!-- gsynchro:v1 id=8cfd4d15-2a4f-411f-ae1c-bd2c02e9aef2 registered=2026-10-23T07:58:07.421Z -->

# M04 - T04 - UI global sync

## Objective
UI global sync.

## Constrained implementation
Connect the sidebar to the shared index updated on pull; synced/offline/error badges.

## Acceptance criteria
A prompt from another machine appears after pull; errors do not block the PTY.

## References
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce databases, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: RPC `search.facets`, `clipboard.*`, `session.end`; clipboard owned by the primary with forwarding from secondary instances; `SearchStore` (200 ms debounce, filters, refresh on event/focus/15 s), real History/Clipboard sidebar with copy/insert, dynamic footer with "Repository not configured", `search:refreshed` event, and 5 s sync-status polling.
- Verification: 256 tests (cross-machine idle, primary/secondary clipboard, store), `sync-ui` smoke with local and remote prompts, filters, copy/insert, sensitive clipboard excluded, footer, no overflow; all other smoke tests passed.
- Follow-up in review: periodic fetch now integrates remote commits (`integrateRemote`) so an idle machine sees the other machine's prompts without writing; dedicated idle-machine test.
- Deviations: periodic 15 s refresh on both tabs; without a primary, sync status is `offline`; copy/insert do not send automatically.
