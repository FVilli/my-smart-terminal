---
title: "M25 - T01 - Resize settings and remove the AI Actions tab"
type: task
project: smart-terminal
created: 2026-10-25
id: "M25-T01"
milestone: "M25"
depends_on: "M24"
deliverables: "Settings dialog 20% taller and narrower with four tabs"
---
# M25 - T01 - Resize settings and remove the AI Actions tab

## Implementation
- Settings dialog height `min(744px, 90vh)` (20% over 620), width `min(640px, 92vw)` in edit mode; onboarding keeps its size.
- Remove the AI Actions tab from `SETTINGS_TABS`, the wizard case, the import and the step union; settings tabs are Repository/AI/STT/Appearance.
- Keep fixed height/internal scroll/pinned footer; update capture `settingsWidth` expectation and settings smoke (no `settings-tab-ai-actions`, width ~640, height ~744 clamp) and docs/15.
## Acceptance
- 4 tabs, new dimensions, no overflow at 1024×700 and zoom, smoke/layout/tests green.
