---
title: Appearance customization scouting
type: research
project: smart-terminal
created: 2026-10-25
---

# Appearance customization scouting

## Current state

- M20 semantic palette lives in `apps/renderer/src/styles.css:10–44`; its `:root` values are dark-only. The same file maps semantic variables to stable Tailwind utility names at lines 46–69; measured chrome geometry is mapped at lines 70–75. `color-scheme: dark` is explicit (line 43). Existing dark values are the approved visual baseline, not expendable sample colors.
- xterm uses literal `TERMINAL_THEME` values for background, foreground, cursor, and selection in `apps/renderer/src/app/terminal-panel.ts:21–26`; this is separate from renderer semantic tokens.
- `AppearanceStore` currently manages terminal font ID and applies `--font-code` (`apps/renderer/src/app/appearance/appearance-store.ts:5–22`). Presets/fallback stacks are in `packages/contracts/src/index.ts:278–288`. `terminal_font` is in `AppConfig` (`apps/desktop/src/main/app-config.ts:37`), parsed at line 151, serialized at line 207, and represented in the onboarding contract at `packages/contracts/src/index.ts:299–301`.
- Settings supports an Appearance tab (`apps/renderer/src/app/settings/settings-store.ts:7–18`); appearance currently means terminal monospace font selection, not a theme panel.
- Capture/layout checks enforce measured geometry and exact dark colors in `scripts/capture-layout.mjs:36–46`. These gates must remain deterministic; no light-theme implementation exists yet. The Electron window has a fixed dark background (`apps/desktop/src/main/main.ts:97–105`, per oracle), so it also needs consideration to avoid a light-content startup flash.

## Candidate options

Ratings are scouting estimates; implementation and test blast radii are anticipated, not existing features. Persistence assumes the local configuration route recommended below. Contrast impact describes design/test burden, not a measured result.

| Option | Implemented today | Blast radius (files / tests / captures) | Persistence | Contrast / accessibility | Risk | Value |
|---|---|---|---|---|---|---|
| Light/dark theme | Dark only; semantic tokens plus literal xterm palette | `styles.css`, appearance/config/UI, xterm, Electron window; config/UI tests and dark/light captures | Local `config.md`; default dark | Full surface, state, focus and terminal contrast review; WCAG checks | MED | High |
| UI font family | Fixed `--font-ui` stack (`styles.css:41`); no selector | Tokens/settings/config; wrapping and geometry tests/captures | Local config if later approved | Readability and text reflow; preserve focus labels | LOW | Modest |
| UI font size | No dedicated setting; app-wide zoom is separate (50–200% baseline) | Global sizing, zoom interaction, layout and screenshot checks | Local config if later approved | Readability improves but can overflow/reflow | MED | Useful |
| Terminal font size | No dedicated size control established; terminal fit behavior is separate | xterm options/fit, terminal tests and captures | Local config if later approved | Legibility versus rows/columns and fit | MED | Useful |
| Line height | No setting; measured geometry should not drift | Renderer styles/layout, geometry tests/captures | Local config if later approved | Readability versus visible rows and clipping | MED | Modest |
| Density | No setting; fixed/measured chrome geometry | Many component layouts, geometry/overflow tests and captures | Local config if later approved | Crowding, target sizes, keyboard focus | MED | Modest |
| Accent colour | Fixed semantic accent/state palette in `styles.css:30–38` | Tokens and all interactive/state surfaces; contrast tests/captures | Local config if later approved | Multiplying color choices risks weak contrast and color-only state | MED | Modest |
| Terminal palette/cursor | Literal xterm theme (`terminal-panel.ts:21–26`) | xterm instances, selection/cursor/ANSI tests and terminal captures | Local config if later approved | High ANSI, cursor, selection and text legibility burden | HIGH | Useful to some |
| Transparency | No feature established | Electron window/compositor/platform behavior; visual tests/captures | Local config if later approved | Variable backgrounds undermine contrast/focus | HIGH | Low |

## Recommendation and design guardrails

Approve the minimum coherent set for M24-T09: explicit **Dark / Light** selection, with Dark default for old and new configurations, and keep the existing terminal monospace presets, installed-font fallback, live preview, and persistence. Do not add OS-following mode now: explicit selection is deterministic and avoids appearance changing with OS settings. Do not alter shell hierarchy, geometry, font sizing, or zoom as part of theme work.

Persist the selected theme in the existing non-secret, machine-local `userData/config/config.md`, alongside `terminal_font`, not the Git-synced session repository. Extend typed config/onboarding validation, allowed keys, parse/serialize paths and tests; missing theme resolves to Dark. The parser rejects unknown keys (`app-config.ts:138–145`), so document and test downgrade behavior: an older binary may reject a config containing the new key. Do not assume optional means downgrade-safe.

Keep dark values unchanged in `:root`; add light overrides through root `[data-theme]` overrides while retaining existing semantic variable and Tailwind utility names. Set `color-scheme` for the selected theme. Update all xterm instances from computed theme values rather than leaving xterm pinned to dark literals; design background, foreground, ANSI palette, cursor, and selection deliberately. Renderer is theme authority; derive Electron `nativeTheme.themeSource` from the same explicit preference only if T08 verifies a platform-native surface requires it (it is not currently used). Apply saved theme before first visible paint, use dark fallback on failure, and align Electron window background to avoid flash.

Top risks: (1) contrast, visible focus, and terminal legibility; validate WCAG AA 4.5:1 normal text, 3:1 large text, and 3:1 meaningful UI/focus indicators, plus xterm ANSI/cursor/selection in each theme; (2) startup flash and fixed native window background; (3) capture determinism. Preserve exact dark capture checks as explicit dark fixture/default, add light-specific color and geometry/overflow checks, and never let developer preference choose test results. Preserve keyboard behavior, measured 75/25 layout, dialog/chrome geometry, and zoom behavior.

## Sequencing

**T08 design:** specify complete dark/light token tables; config field, default, validation/migration and downgrade behavior; xterm palette/selection treatment; startup and window background strategy; representative terminal, composer, sidebar, settings/onboarding and AI surfaces; contrast/focus results; and acceptance criteria.

**T09 implementation:** implement only explicit dark/light plus retain terminal font selection. Verify old configs open pixel-stable Dark, Light survives restart, switching updates UI/native controls/all active and inactive xterm instances, unsaved cancel restores saved theme, and font preview/save/cancel/fallback remain intact. Test config validation/default/serialization, live application, persistence, failure fallback, keyboard focus, and contrast-sensitive surfaces. Keep dark exact-color/layout gates at 1440×900 and 1024×700; add deterministic light checks at both sizes and no-overflow checks.

**Deferred:** UI font family, UI and terminal font size (assess separately from zoom), line height, density, user-selectable accent, terminal palette/cursor customization, and transparency.

## Open questions and limits

- Should an OS-following preference be offered later, and how should OS changes interact with an explicit saved choice?
- Should user-defined accents ever be supported, and what constrained palette/contrast validation would be required?
- Is transparency valuable enough to accept platform-specific compositor and contrast behavior?
- What is the screenshot update policy for intentional light-theme baselines while keeping dark pixel stability?
- T08 must settle downgrade behavior if old-version config rejection is unacceptable. No contrast audit or hardware/platform verification is claimed by this scouting document.
