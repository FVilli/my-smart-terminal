---
title: "M26 - T01 - Show only sparkles on the composer trigger"
type: task
project: smart-terminal
created: 2026-10-25
id: "M26-T01"
milestone: "M26"
depends_on: "M25"
deliverables: "Composer AI trigger with sparkles only and unchanged behaviour"
---
# M26 - T01 - Show only sparkles on the composer trigger

## Implementation
- Remove the `<span>AI</span>` from the composer AI button; keep the sparkles SVG, `data-testid="ai-correction"`, aria-label/title ("AI actions") and click behaviour.
- Adjust the button's width/gap classes so the single glyph is centered (still 28 px wide) and disabled/busy states remain legible ("…" while busy).
## Acceptance
- No text label, centered sparkles, aria name intact; AI smoke/Use flow unchanged.
