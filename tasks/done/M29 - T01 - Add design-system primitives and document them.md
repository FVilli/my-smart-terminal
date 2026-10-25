---
title: "M29 - T01 - Add design-system primitives and document them"
type: task
project: smart-terminal
created: 2026-10-25
id: "M29-T01"
milestone: "M29"
depends_on: "M28"
deliverables: "Form/panel primitives in styles.css plus docs/45 design system guide"
---
# M29 - T01 - Add design-system primitives and document them

## Implementation
- Add `form-field`, `form-label`, `form-help`, `form-error`, `form-stack`, `field-counter`, `panel-header`, `panel-title`, `panel-footer` to `@layer components`, using existing semantic tokens only.
- Document the minimal design system in `docs/45 - Design system.md`: tokens, spacing, field anatomy, buttons/icons, panel anatomy, model/test-id rules.
## Acceptance
- Primitives compile and are token-only; doc links pass; no visual regression.
