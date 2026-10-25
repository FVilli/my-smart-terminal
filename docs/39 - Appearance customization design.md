---
title: Appearance customization design
type: design
project: smart-terminal
created: 2026-10-25
---

# Appearance customization design

## Approved scope and decisions

M24-T09 is approved for explicit **Dark / Light** appearance selection and retention of the existing terminal-font selector. Dark remains the default, including for configs that omit the new field. Appearance is a machine-local preference in `userData/config/config.md`, never session data. There is no OS-following mode.

Deferred: UI font family/size, terminal font size, line height, density, user-selectable accent, custom terminal palette/cursor, transparency, and System theme. Do not change shell hierarchy, measured geometry, zoom behavior, or existing font presets/fallback behavior.

## Configuration contract

Add optional `terminal_theme: "dark" | "light"` to local `config.md`, alongside `terminal_font`. Missing field resolves to `dark`; serializers may omit the default or emit it consistently, but parsing and UI behavior must be deterministic. Add the key to the known-key allowlist, strict validation, parsing and serialization, and the onboarding config type. Reject any other value. Preserve the existing config schema version policy unless implementation discovers that a schema bump is required; do not infer it here.

This is an additive-write compatibility caveat: older app versions reject unknown config keys and may warn, treat the config as corrupt, or reject it through existing recovery handling. Do not claim downgrade compatibility. Document this in user-facing config guidance. Docs/12 and docs/19 contain configuration instructions/contracts and must be checked for the exact older-version warning/rejection behavior; reconcile their wording during T09 rather than implying old versions preserve the new key. The local config remains the authoritative persistence path.

## Token architecture and light palette

Keep all current dark values in `:root` byte-for-byte unchanged. Put light overrides on `:root[data-theme='light']`, preserving every semantic variable and existing Tailwind utility mapping/name. Set `color-scheme: dark` and `color-scheme: light` respectively. No component-by-component palette or new parallel utility vocabulary. The following light values are proposed hex/RGBA design values; contrast verification is a T09 gate, not a claim that an implementation audit has already run.

| Token | Light value | Purpose / contrast rationale |
|---|---|---|
| `--bg` | `#f4f6f8` | Cool neutral application canvas; distinguishes elevated panels. |
| `--terminal-bg` | `#ffffff` | White terminal/editor canvas for maximum text clarity. |
| `--tab-bg` | `#e8edf2` | Clear tab strip separation without dark chrome. |
| `--tab-active` | `#d5e0e8` | Selected tab remains visibly distinct; foreground stays dark. |
| `--input-bg` | `#ffffff` | High clarity for editable controls. |
| `--sidebar-bg` | `#f4f6f8` | Sidebar aligns with app canvas. |
| `--card-bg` | `#ffffff` | Raised content card surface. |
| `--surface` | `#e8edf2` | Secondary surface consistent with tab strip. |
| `--surface-raised` | `#ffffff` | Raised surfaces remain bright and legible. |
| `--border` | `#c5cdd5` | Neutral separators; validate 3:1 when conveying component boundaries. |
| `--border-soft` | `#aeb9c4` | Softer but visible control outlines. |
| `--text` | `#18212b` | Near-black primary text; calculated 16.26:1 on white, 15.01:1 on `--bg`. |
| `--text-muted` | `#526170` | Calculated 6.36:1 on white, 5.87:1 on `--bg`; check every pairing. |
| `--accent` | `#006b57` | Calculated 6.48:1 on white, 5.98:1 on `--bg`; verify UI boundary contrast. |
| `--danger` | `#b42318` | Calculated 6.57:1 on white, 6.07:1 on `--bg`. |
| `--danger-strong` | `#8f1d14` | Calculated 8.92:1 on white, 8.24:1 on `--bg`. |
| `--warning` | `#805400` | Dark amber, calculated 6.59:1 on white, 6.08:1 on `--bg` (not pale yellow text). |
| `--syncing` | `#805400` | Matches warning; calculated 6.59:1 on white, 6.08:1 on `--bg`. |
| `--record` | `#b4232b` | Calculated 6.53:1 on white, 6.03:1 on `--bg`. |
| `--record-strong` | `#a31621` | Calculated 7.80:1 on white, 7.20:1 on `--bg`. |
| `--focus-ring` | `rgb(0 107 87 / 30%)` | Teal focus halo; verify visible contrast against adjacent surfaces. |
| `--backdrop` | `rgb(24 33 43 / 55%)` | Modal dimming while retaining context. |

Contrast targets: WCAG AA **4.5:1** for normal text, **3:1** for large text and meaningful UI/focus indicators. Check actual foreground/background pairings and focus outline against adjacent colors; semantic intent or a color name is not proof. State meaning must not rely on color alone. Fix any failed pairing as part of T09 and record measured results in tests/review evidence.

## xterm palette and live updates

Replace the single literal `TERMINAL_THEME` in `terminal-panel.ts` with a typed per-theme palette. Dark values remain exactly the current values: background `#171e25`, foreground `#e6edf3`, cursor `#4cc2a5`, selection `#2c3a4a`; preserve the current effective ANSI defaults in dark mode. Light palette starting point: background `#ffffff`, foreground `#18212b`, cursor `#006b57`, selection `#b8d9d0`.

Set a complete 16-colour ANSI palette in each theme (normal black/red/green/yellow/blue/magenta/cyan/white and corresponding bright eight). The light palette should use darkened ANSI hues on white for readable terminal text; the dark palette must retain its existing rendering rather than silently recolor prior output. Verify each ANSI color in context, including bold/bright behavior, and cursor/selection visibility. No user customization of ANSI colors is in scope.

AppearanceStore is the renderer theme authority. Its theme signal/change effect must update root `data-theme`; each terminal panel subscribes to the current computed palette and writes `terminal.options.theme`. This applies to every terminal instance, including inactive panels, not only the focused terminal. Theme changes must not recreate terminal sessions or alter font selection; keep font updates on their existing path.

## Startup, window, and settings behavior

Apply saved theme before first visible renderer paint. The startup configuration path currently loads onboarding/config state asynchronously; T09 must arrange a pre-paint bootstrap (or equivalent gating) so the saved theme is set before display, with dark as immediate fallback if loading fails or no preference exists. Keep first-render deterministic and avoid a light-to-dark flash. Set Electron `BrowserWindow.backgroundColor` from the same selected theme before showing the window; dark fallback applies on failure. Do not introduce OS-following or a second independent theme authority.

In Settings > Appearance, add a Dark/Light control and retain the terminal font selector. Theme selection previews immediately. Save persists both edited preference(s); Cancel restores the previously saved theme and font, not merely closes the dialog. Preserve the existing 60%-wider fixed-height settings dialog exactly; verify controls fit without overflow at supported zoom levels.

## T09 acceptance and test plan

- Config tests: missing field defaults dark; valid enum accepted; invalid type/value rejected; parse/serialize round trip; onboarding type/validation; migration/read of existing configs; documented downgrade warning/rejection behavior.
- Runtime: switch both directions without restart; all active and inactive terminals update; Cancel restores saved state; Save persists; restart restores Light; missing/failed config falls back Dark.
- Dark regression: layout and exact color assertions remain pixel-stable against existing baseline at both 1440x900 and 1024x700. No weakening of existing dark checks.
- Light captures: add deterministic Light fixtures at 1440x900 and 1024x700; assert semantic colors, geometry and no overflow. Developer preferences must not select fixture theme.
- Update `scripts/capture-layout.mjs` for explicit dark and light fixtures/checks and `scripts/capture-screenshots` (or its actual package-script target) to capture both themes. Verify the real script/package command and retain stable outputs; do not invent a script if absent.
- Contrast audit: normal text 4.5:1; large text, UI boundaries, and focus indicators 3:1. Include actual state colors and dialog/native controls; document measured ratios.
- xterm: verify foreground, all 16 ANSI colors, cursor and selection for both themes, including inactive terminal instances and representative output.
- Exercise keyboard navigation and `:focus-visible`; test app zoom 50–200%, clipping, dialog dimensions and no horizontal/vertical overflow at both viewport sizes.
- Update related docs/05, docs/12, docs/15, docs/19, docs/28, and docs/38 for implemented contract, compatibility, palette ownership, baseline/capture policy, and deferred scope. Keep claims aligned with actual behavior.

## Ordered T09 implementation steps

1. `packages/contracts/src/index.ts`: theme union/type and onboarding field, without changing unrelated contracts.
2. `apps/desktop/src/main/app-config.ts` and its specs: optional config field, allowlist, validation, parse/serialize/default and migration tests; settle actual downgrade warning/recovery wording.
3. Startup/preload/renderer bootstrap boundary (`apps/desktop/src/main/main.ts`, relevant IPC/preload and `apps/renderer/src/app/app.ts` only as required): retrieve preference before first paint, dark fallback, theme-aware window background.
4. `apps/renderer/src/styles.css` and appearance store: unchanged dark tokens, light overrides, root theme application and config-backed state.
5. `apps/renderer/src/app/terminal-panel.ts`: dual palettes and reactive updates to all instances.
6. Appearance settings UI/store and tests: immediate preview, save/cancel, preserve font selector and fixed dialog geometry.
7. `scripts/capture-layout.mjs`, screenshot capture command/fixtures, and automated tests: deterministic dual-theme captures and checks.
8. Docs/05, /12, /15, /19, /28, /38: reconcile guidance and baseline with verified implementation; retain this design as design intent and clearly label any later deviations.

## Non-goals

No System/OS-following theme, accent or ANSI customization, transparency, font-family/size controls beyond existing terminal presets, density/line-height/layout redesign, session-synced appearance, or dark palette refresh. No claim of hardware/platform validation until tested on target environments.
