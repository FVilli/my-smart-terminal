---
title: "Renderer styling audit"
type: audit
project: smart-terminal
created: 2026-10-24
---
<!-- gsynchro:v1 id=96cbc5c8-92a8-458f-b7b8-0c67d7de6b26 registered=2026-10-24T22:29:07.241Z -->

# Renderer styling audit

Read-only inventory of Angular renderer styling for M20-T01. No source files were modified. Line ranges are approximate and captured at audit time.

## 1. Styling entry points

| File | Role | Range |
| --- | --- | --- |
| `apps/renderer/src/styles.css` | Global reset, design tokens, xterm import | 1–48 |
| `apps/renderer/src/index.html` | Document shell + CSP; no inline styles | 1–16 |
| `apps/renderer/src/app/app.css` | App shell layout, notices, empty state | 1–11 |
| `apps/renderer/src/app/app.html` | App shell template | 1–75 |
| `apps/renderer/src/app/terminal-panel.css` | Terminal host, status/badge overlays | 1–48 |
| `apps/renderer/src/app/terminal-panel.html` | Terminal host template | 1–9 |
| `apps/renderer/src/app/header/app-header.ts` | Inline `template` / `styles` | 9–26 / 28–42 |
| `apps/renderer/src/app/session-tabs/session-tabs.ts` | Inline `template` / `styles` | 7–77 / 78–105 |
| `apps/renderer/src/app/status-footer/status-footer.ts` | Inline `template` / `styles` | 9–17 / 18–27 |
| `apps/renderer/src/app/sidebar-panel/sidebar-panel.ts` | Inline `template` / `styles` | 21–124 / 125–155 |
| `apps/renderer/src/app/assisted-input/assisted-input.ts` | Inline `template` / `styles` | 11–58 / 59–86 |
| `apps/renderer/src/app/onboarding/onboarding-wizard.ts` | Inline `template` / `styles` | 42–258 / 259–307 |
| `apps/renderer/src/app/messages/message-center.ts` | Inline `template` / `styles` | 13–21 / 22–30 |
| `apps/renderer/src/app/terminal-workarea/terminal-workarea.ts` | Inline `template` / `styles` | 6 / 7–9 |
| `angular.json` | `renderer.build.options.styles` entry; component-style budgets | 1–73 (styles 32–34; budgets 41–46) |
| `apps/renderer/tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json` | TS/Angular compiler config; no style-specific settings | 1–17 / 1–9 / 1–9 |

No SCSS/Less, CSS framework, or Tailwind is present yet. The only third-party CSS is `@import "@xterm/xterm/css/xterm.css"` (`styles.css:1`). No second/generated styling system found.

## 2. Selector/ownership map

| Layout region | Owner | Key selectors |
| --- | --- | --- |
| Title bar / window controls | `app-header` | `.header`, `.title`, `.toggle`, `.settings`, `.window-controls` |
| Session tab bar | `app-session-tabs` | `.tabs`, `.tab`, `.tab-close`, `.plus`, `.menu` |
| Terminal workarea | `app-terminal-workarea` + `app-terminal-panel` | `:host`, `.terminal-host`, `.terminal-status`, `.terminal-badge` |
| Assisted input / composer | `app-assisted-input` | `.composer`, `.editor`, `.actions`, `.icon`, `.voice` |
| Status footer + messages | `app-status-footer` + `app-message-center` | `:host`, `.badge`, `.dot`, `.primary`, `.message` |
| Right sidebar (Clipboard/History) | `app-sidebar-panel` (+ `.sidebar` in `app.css:5`) | `.tabs`, `.filters`, `.list`, `.entry`, `.meta`, `.preview` |
| Settings tabs | `app-onboarding-wizard` | `.settings-tabs`, `[role='tab']` |
| Onboarding modal | `app-onboarding-wizard` | `.backdrop`, `.dialog`, `.dialog-body`, `footer` |
| App shell notices / empty state | `App` | `.shell`, `.main-column`, `.notice`, `.empty-state` |

Duplicated rule groups (candidates for shared primitives):
- **Button resets** — `app.css:9`, `session-tabs.ts:92` (`button`), `assisted-input.ts:67` (`.icon`), `sidebar-panel.ts:128/136/141`, `onboarding-wizard.ts:278`, `header/app-header.ts:34–40`.
- **Form controls** — `sidebar-panel.ts:132` (`input, select`), `onboarding-wizard.ts:271` (`input, select`).
- **Panel headers / tabs** — `session-tabs.ts:80–105`, `sidebar-panel.ts:127–129`, `onboarding-wizard.ts:268–269`.
- **List rows / cards** — `sidebar-panel.ts:149–155` (`.entry`, `.meta`, `.preview`), `app.css:9` (notice/empty buttons).
- **Scrollbars** — `sidebar-panel.ts:148` (`.list` overflow), `assisted-input.ts:63` (`.editor` scrollbar-gutter); no shared scrollbar styling.
- **Focus rings** — `header/app-header.ts:37`, `session-tabs.ts:87`, `assisted-input.ts:62` (focus-within); no global focus rule in `styles.css`.

## 3. Token inventory

Defined tokens (`styles.css:4–19`):

| Token | Value | Line |
| --- | --- | --- |
| `--bg` | `#0a0d10` | 4 |
| `--terminal-bg` | `#171e25` | 5 |
| `--tab-bg` | `#212b38` | 6 |
| `--input-bg` | `#222e3c` | 7 |
| `--sidebar-bg` | `var(--terminal-bg)` | 8 |
| `--tab-active` | `#384a5d` | 9 |
| `--card-bg` | `var(--input-bg)` | 10 |
| `--surface` | `#212b38` | 11 |
| `--surface-raised` | `#222e3c` | 12 |
| `--border` | `#161d26` | 13 |
| `--text` | `#e6edf3` | 14 |
| `--text-muted` | `#8b9bab` | 15 |
| `--accent` | `#4cc2a5` | 16 |
| `--danger` | `#f07067` | 17 |
| `--font-ui` | Inter, 'Segoe UI', system-ui, -apple-system, sans-serif | 18 |
| `--font-mono` | JetBrains Mono … Consolas, monospace | 19 |

Plus `color-scheme: dark` (`styles.css:20`). Runtime override: `appearance-store.ts:21` writes `--font-mono` via `document.documentElement.style.setProperty(...)` when the terminal font changes.

`--border-soft` is defined in `styles.css`; the light appearance overrides it while preserving utility names.

**Literal colors outside tokens** (triage during token migration):

| File:line | Literal |
| --- | --- |
| `terminal-panel.ts:21–24` | xterm theme `#171e25` / `#e6edf3` / `#4cc2a5` / `#2c3a4a` |
| `header/app-header.ts:41` | close hover `#c42b1c` |
| `status-footer/status-footer.ts:23` | syncing dot `#e3b341` |
| `message-center.ts:25`, `onboarding-wizard.ts:273` | warning `#e0b050` |
| `onboarding-wizard.ts:282` | rec dot `#e5484d` |
| `assisted-input.ts:83–84` | mic pulse `#e5484d`, `#ff6b6b` |
| `sidebar-panel.ts:145` | `--danger` fallback `#e5484d` |
| `onboarding-wizard.ts:260` | backdrop `rgba(5, 8, 11, .7)` |
| `assisted-input.ts:62` | focus ring `rgba(76, 194, 165, .18)` |
| `assisted-input.ts:84` | pulse shadow `rgba(229, 72, 77, .7)` |
| `header/app-header.ts:36` | `color-mix(in srgb, var(--accent) 12%, transparent)` |

**Font stacks** live only in `--font-ui` / `--font-mono`. Component literal font use: `terminal-panel.css:26,45` (`var(--font-ui)`), `assisted-input.ts:63` (`var(--font-mono), monospace`), `sidebar-panel.ts:154` (`var(--font-mono)`).

**Radii**: 4px (`header:34`, `session-tabs:92/101`, `assisted-input:67`), 6px (`app.css:9`, `session-tabs:99`, `sidebar-panel:132/136/141`, `onboarding-wizard:271/278/307`, `header:38`), 8px (`assisted-input:61`, `terminal-panel.css:22,41`), 10px (`onboarding-wizard:261`), 50% (`status-footer:22`, `assisted-input:77`), 1px (`onboarding-wizard:285`).

**Spacing/heights**: header 35px (`header:30`), tab bar 37px (`session-tabs:80`), footer 28px (`status-footer:19`), composer 120px (`assisted-input:61`), 12px panel padding, 8px/16px composer padding.

**Focus rules**: `header:37`, `session-tabs:87`, `assisted-input:62`; `.editor { outline: 0 }` (`assisted-input.ts:63`); no global focus style.

## 4. Risks

- `!important`: none anywhere in `apps/renderer/src`.
- Inline `style="..."` attributes: none in templates. Non-template equivalents: `[style.display]` host binding (`terminal-panel.ts:33`) and the JS `--font-mono` write (`appearance-store.ts:21`).
- `:host` rules: 9 files — `app.css:1`, `terminal-panel.css:1`, `header:29`, `session-tabs:79`, `status-footer:19`, `sidebar-panel:126`, `assisted-input:60`, `terminal-workarea:8`, `message-center:23`. `onboarding-wizard` has no `:host` but uses broad element selectors (`header`, `label`, `button`, `input`, `select`, `footer`) under default emulated encapsulation.
- Encapsulation: all components use default `ViewEncapsulation.Emulated`; only `styles.css` is global. No `::ng-deep`, `ViewEncapsulation.None`, or `host` metadata styling beyond the terminal display binding.
- Animations/transitions: only `@keyframes mic-pulse` (`assisted-input.ts:81–85`); no transitions.
- Platform/browser-specific: `-webkit-app-region: drag/no-drag` (`header:30,33`), `-webkit-font-smoothing` (`styles.css:40`), `scrollbar-gutter`, `font-variant-ligatures`, `font-feature-settings` (`assisted-input.ts:63`), `color-scheme` (`styles.css:20`), `color-mix()` (`header:36`).
- Must stay component-scoped: `:host` flex layout roles, window drag regions, and `.terminal-host` geometry. Theme token overrides belong in `styles.css`; xterm's per-theme literal map belongs in `appearance/terminal-theme.ts`.
- xterm separation: `@import "@xterm/xterm/css/xterm.css"` (`styles.css:1`) is the only third-party CSS; `appearance/terminal-theme.ts` owns per-theme xterm literal palettes, the justified exception to semantic CSS token ownership.

## 5. Test/verification surface relevant to styling

- `scripts/capture-layout.mjs`: asserts 75/25 split (`0.75 ± 0.02`), no overflow, header 35±2, tab bar 38±2, input 110–160, footer 28±2, exact backgrounds `rgb(56, 74, 93)` (active tab), `rgb(23, 30, 37)` (sidebar/terminal), `rgb(33, 43, 56)` or `rgb(34, 46, 60)` (input).
- `apps/desktop/src/main/capture.ts` (`METRICS_SCRIPT`, 5–32) reads those DOM metrics/backgrounds and saves PNGs.
- `apps/desktop/src/main/smoke.ts` styling-sensitive checks: `editorMonospace` (282), `editorWhiteText === rgb(230, 237, 243)` (283), `actionsBottomRight` geometry (285), `noOverflow` (615), settings `fixedSettingsHeight` (658–669), `noSidebarOverflow` (419, 1021); plus `data-testid` anchors throughout that must not be renamed/removed.
- Zoom: `apps/desktop/src/main/zoom.ts` + `zoom.spec.ts`; applied via `webContents.setZoomFactor` in `main.ts:119–131` before xterm sees input.
- Unit tests do not assert CSS; `grep 'rgb('` matches only `smoke.ts:283` and `capture-layout.mjs` color strings. `terminal-copy.spec.ts` is behavior-only.

## 6. Proposed migration order (T02–T06)

Single-owner rule: each shared file below is edited by exactly one task, in sequence.

| Task | Files |
| --- | --- |
| T02 Tailwind integration | root `package.json`, `apps/renderer/package.json`, `angular.json`, `apps/renderer/src/styles.css` (add Tailwind entry, keep tokens) |
| T03 tokens/shared primitives | `apps/renderer/src/styles.css` (expand/finish token set, add shared primitives), `apps/renderer/src/index.html` if needed |
| T04 shell/tabs/sidebar/footer | `app.css`, `app.html`, `app-header.ts`, `session-tabs.ts`, `status-footer.ts`, `message-center.ts`, `sidebar-panel.ts`, `terminal-workarea.ts` |
| T05 assisted input/settings | `assisted-input.ts`, `onboarding-wizard.ts` |
| T06 cleanup/regression | remove superseded selectors from all touched files; keep `terminal-panel.css` + `terminal-panel.ts` xterm theme; run `capture-layout.mjs` + renderer smokes + zoom |

Shared files touched by only one task at a time: `apps/renderer/src/styles.css` (T02 then T03 — do not edit concurrently), `angular.json` (T02 only), `package.json` (T02 only). `app.*` (T04 only); component `.ts` files stay within their single task; `terminal-panel.*` is touched only in T06.

## Baseline capture

Captured by the parent before any migration, with `npm run test:layout` (build + Electron metrics at both viewports), on 2026-10-24. Xvfb at `~/.local/xvfb/usr/bin/Xvfb` was used through `scripts/run-electron.mjs`; no window opened on the user desktop.

Images: `docs/assets/m20-baseline/layout-1440x900.png`, `docs/assets/m20-baseline/layout-1024x700.png`.

| Metric | 1440×900 | 1024×700 | Gate (`scripts/capture-layout.mjs`) |
| --- | --- | --- | --- |
| `ratio` (sidebar left / width) | 0.75 (`sidebarLeft` 1080, `sidebarWidth` 360) | 0.75 (`sidebarLeft` 768, `sidebarWidth` 256) | 0.75 ± 0.02 |
| `overflow` / `scrollWidth` vs `clientWidth` | false / 1440 = 1440 | false / 1024 = 1024 | false |
| `headerHeight` | 35 | 35 | 35 ± 2 |
| `tabBarHeight` | 38 | 38 | 38 ± 2 |
| `inputHeight` | 137 | 137 | 110–160 |
| `footerHeight` | 28 | 28 | 28 ± 2 |
| `activeTabBg` | `rgb(56, 74, 93)` | `rgb(56, 74, 93)` | exact |
| `sidebarBg` | `rgb(23, 30, 37)` | `rgb(23, 30, 37)` | exact |
| `terminalBg` | `rgb(23, 30, 37)` | `rgb(23, 30, 37)` | exact |
| `inputBg` | `rgb(34, 46, 60)` | `rgb(34, 46, 60)` | `rgb(33, 43, 56)` or `rgb(34, 46, 60)` |
| `sidebarCardBg` | null (no card in the smoke data state) | null | not asserted |

Result at baseline: both viewports `OK`, exit code 0; full metrics in the run log of `npm run test:layout`.

Reproduce: `npm run test:layout` (requires a display; the script starts Xvfb on `:99` when available, otherwise see `docs/11 - IPC contracts and runtime verification.md`).

Pre-migration state:
- `npm run lint`, `npm run typecheck:node`, `npm run build` and `npx vitest run` (38 files / 408 tests) passed before the migration.
- No `!important` and no template `style="..."` attributes existed, so the migration cannot hide behind them.
- Theme ownership: semantic tokens and light overrides are centralized in `styles.css`; literal xterm colors are limited to the per-theme palette map in `appearance/terminal-theme.ts`.
- Zoom 50%/100%/200% is covered by `apps/desktop/src/main/zoom.spec.ts` (unit) and the Electron zoom path; no automated screenshot harness exists for zoom levels, so T06 compares 50%/100%/200% manually on the built app and records it as evidence.

Pre-migration evidence observed here (only the allowed commands were run):
- `npx tsc -p tsconfig.json --noEmit` → passed (node-side typecheck; root tsconfig excludes the renderer).
- `npm test` (`vitest run`) → 38 files / 408 tests passed.
- No `!important` usages and no template `style="..."` attributes.
- `--border-soft` is defined in the shared token source.
- Not run: `capture-layout.mjs` / Electron smokes / `ng build renderer` (display/Electron build required; deferred to parent).

## Migration log and evidence (M20)

| Task | Change | Verification |
| --- | --- | --- |
| T02 | Pinned `tailwindcss`/`@tailwindcss/postcss` 4.3.3, `apps/renderer/.postcssrc.json`, theme+utilities imports with explicit `@source`, preflight intentionally excluded | production bundle contains a generated utility; xterm CSS still inlined; layout metrics identical |
| T03 | Single token source in `styles.css`, `@theme inline` mapping, `.btn/.icon-btn/.field/.card`, geometry utilities, `--font-code` rename, `--border-soft` defined | layout metrics identical; lint/tests/build pass |
| T04 | Shell, header, tabs, footer, message center, sidebar, workarea converted; `app.css` deleted; host roles moved to `host.class`; base reset moved into `@layer base` | metrics identical; 1308 px diff vs T03 confined to the sidebar filter row (placeholder + sub-pixel text); IPC/tabs/search/clipboard/sidebar/settings smokes pass |
| T05 | Composer and settings/onboarding converted; `.field-sm` added; `bg-backdrop` token fixed; paragraph margins/line-heights matched; dead `.stt-debug` and mic-check rules removed | composer pixel-identical; capture screenshots 8/8 OK with 0 diff on settings/STT/AI screens; all 10 smokes pass |
| T06 | Dead `.terminal-status--error` removed; docs/06 and docs/15 updated; zoom and packaging verified | `test:layout`, zoom 50/100/200, capture harness, smokes, `package:deb` + `test:deb`, lint/tsc/vitest all green |

Residual caveats:
- Documentation screenshots in `docs/assets/screenshots` predated M20 at audit time; M22 refreshed the harness set (`09-ai-actions.png`, updated `04-ai-review.png`). The M20 evidence still lives in `docs/assets/m20-baseline` plus the harness output.
- Component CSS that remains is intentional: window drag regions, state rules that depend on Angular class bindings, mic pulse keyframes, fixed-height settings dialog, STT glyphs/table, xterm host/status. No palette literal lives outside `styles.css` and `TERMINAL_THEME`.

Independent review (M20-T06, second pass with the committed diff and exported evidence): verdict **acceptable**; the only finding was the documented ±1 px rounding of the tab bar/composer host at 50% zoom (`39`/`138` px vs `38`/`137`), which is inside the stated fractional-zoom tolerance and not a geometry regression. No blockers, no dead rules, no palette literals outside `styles.css` and `TERMINAL_THEME`, DOM/test hooks and disabled/focus semantics preserved.
