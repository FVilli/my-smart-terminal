---
title: "M25 - T04 - Verify tests, smokes, docs and screenshots"
type: task
project: smart-terminal
created: 2026-10-25
id: "M25-T04"
milestone: "M25"
depends_on: "M25-T03"
deliverables: "Updated smokes/captures/docs and evidence-backed verification"
---
# M25 - T04 - Verify tests, smokes, docs and screenshots

## Implementation
- Update settings/AI smokes for the new geometry, header ids/icons, modal open/close, footer counter, confirmed delete, and ensure no AI Actions in settings.
- Capture scenarios: settings dialog (4 tabs, new size), AI Actions modal, header; refresh screenshots deterministically.
- Docs: 12 (header icons, AI Actions modal), 13/15 (dialog metrics), 28/36/39 (component ownership and modal), 37/40 status notes.
- Run lint/tsc/vitest/build/layout/zoom/smokes and an independent review; record findings/fixes in a short audit note or docs update.
## Acceptance
- All gates green, docs/screenshots match, no stale AI Actions settings references.
