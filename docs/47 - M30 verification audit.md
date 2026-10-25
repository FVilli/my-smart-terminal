---
title: "M30 verification audit"
type: audit
project: smart-terminal
created: 2026-10-25
---
# M30 verification audit

Design-system adoption sweep. Baseline `08c3214`; ships in v1.4.0.

- Removed all seven component `styles:` blocks; centralized state rules, drag regions, markdown typography, composer mic animation and settings geometry into named token-only primitives.
- Added `@theme` tokens for tabbar/control/icon/add-session/window-control/menu/refresh spacing, panel radius, caption/menu/window-control typography, composer geometry, status rhythm and modal shells.
- Replaced component arbitrary design values (typography, gaps, padding, radius, opacity, shadows, icon/button sizes) with tokens/primitives in AI surfaces, composer, sidebar, message center and settings.
- Guard `tests/renderer-style-guard.spec.ts`: rejects component `styles:`, inline `style=`, `!important`, colour literals outside the xterm palette, and arbitrary design utilities. Structural allowlist: `session-tabs` 220px, onboarding dialog `min(520px,92vw)`/90vh, `min-w-[180px]`, header `w-[45%]`.
- Verification: lint, tsc, vitest 493, build, AI/settings/STT smokes, layout 4/4, 13 captures.
- Justified exceptions: xterm palette colours (`appearance/terminal-theme.ts`), structural widths above, third-party DOM.
- Note: two broad audit children timed out before the switch to smaller scopes; all remaining areas were covered by the small audits and three sequential delegate batches. No parallel writers were used.
