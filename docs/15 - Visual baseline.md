---
title: "Visual baseline and mock measurements"
type: design
project: smart-terminal
created: 2026-10-23
---
<!-- gsynchro:v1 id=48047092-9568-4980-b4ac-ff3206eeaf26 registered=2026-10-23T13:00:27.388Z -->

# Visual baseline and mock measurements

Reference: `mockups/Smart Terminal - final mock.png` (1930×1327). Comparison: real English screenshot at 1440×872 content area (`docs/assets/screenshots/02-terminal-tabs.png`).

## Measured mock geometry

| Region | Mock pixels | Share of content height | Target at 872 px |
| --- | --- | --- | --- |
| Window/menu/header area | y0–121 | 9.2% | app header 48 px; the mock top likely includes window chrome |
| Session tab bar | y123–214 (92 px) | 7.0% | 52–56 px |
| Tab/terminal separator | y218–227 (10 px) | 0.8% | 1 px border |
| Terminal output | y228–1121 (894 px) | 67.8% | flexible remainder (~610 px) |
| Assisted input | y1125–1286 (162 px) | 12.3% | 96–110 px including toolbar/spacing |
| Status footer | y1290–1318 (29 px) | 2.2% | 28 px |

Horizontal split: terminal ends at x1443 of 1930 → **74.8% / 25.2%**, implemented as a 75/25 grid with `min-width: 0`.

## Measured current geometry (1440×872)

| Region | Current |
| --- | --- |
| Header/title bar | 35 px (`#171e25`) |
| Tab bar | 38 px (active tab `#384a5d`) |
| Terminal | ~672 px (`#171e25`) |
| Assisted input | ~136 px (`#222e3c`) |
| Footer | 28 px (`#212b38`) |
| Sidebar | 360 px at 1440 (25%), `#171e25` |
| Main accent | `#4cc2a5` |

## Target palette

| Token | Target | Notes |
| --- | --- | --- |
| Title bar | 35 px | full-window, M16A |
| `--terminal-bg` | `#171e25` | matches mock |
| `--tab-bg` | `#212b38` | inactive tab bar |
| `--tab-active` | `#384a5d` | active tab, full-height fill |
| `--input-bg` | `#222e3c` | composer interior; composer surroundings use terminal background |
| `--sidebar-bg` | `#171e25` | sidebar, matches terminal |
| `--card-bg` | `#222e3c` | history/clipboard cards, matches input |
| `--border` | `#161d26` | separators |
| `--text` / `--text-muted` | `#e6edf3` / `#8b9bab` | readable contrast |
| `--accent` | `#4cc2a5` | keep the existing accessible accent; `#8cc7a1` was a single terminal sample, not a UI palette |
| Footer | `#171e25` | same as terminal, thin top border |

Typography: monospace for terminal, assisted editor, session labels and tab targets; UI chrome may use the system sans-serif. Active tab is a filled `#384a5d` surface, not the terminal background.

## Method

1. Capture 1440×900 and 1024×700 on Xvfb (content height is 872 at a 900 logical window because the window frame is excluded).
2. Read DOM metrics (split, overflow) from `SMART_TERMINAL_LAYOUT_RESULT`.
3. Sample screenshot colors and row/column transitions with a PNG decoder (Pillow or equivalent) at known regions.
4. Record deltas against this document; do not use full-image pixel-perfect diffing because antialiasing and fonts vary by platform.

## Zoom and terminal keyboard behavior

Ctrl/Cmd+- and Ctrl/Cmd+Plus (including Ctrl+=, Ctrl+Shift+=, and numpad add/subtract) adjust zoom in 10% steps from 50% to 200%; Ctrl/Cmd+0 resets to 100%. These zoom shortcuts are handled by Electron before input reaches xterm. Other keys are not intercepted; terminal applications may consume other Ctrl/Cmd shortcuts.

## Out of scope

The mock's top black strip may include the operating-system window chrome; do not reproduce title-bar controls inside the app. Preserve all functional English copy, accessibility labels and the 75/25 contract.

## M20 token and utility mapping

Single source of truth: `apps/renderer/src/styles.css`. Raw values are declared once in `:root`; the `@theme inline` block exposes them to Tailwind 4, so components use utilities instead of literals. Tailwind preflight is intentionally not imported: the renderer keeps the small `styles.css` reset as its only base layer, which is why the approved geometry did not move when Tailwind was added.

| Raw token | Value | Utility | Used for |
| --- | --- | --- | --- |
| `--bg` | `#0a0d10` | `bg-app` | document background behind the shell |
| `--terminal-bg` | `#171e25` | `bg-terminal` | terminal, header, composer surroundings, footer |
| `--tab-bg` | `#212b38` | `bg-tab` | inactive tab bar, menus |
| `--tab-active` | `#384a5d` | `bg-tab-active` | active session tab |
| `--input-bg` | `#222e3c` | `bg-input` | composer interior |
| `--sidebar-bg` | `var(--terminal-bg)` | `bg-sidebar` | right panel |
| `--card-bg` | `var(--input-bg)` | `bg-card` | history/clipboard cards, form controls |
| `--surface` / `--surface-raised` | `#212b38` / `#222e3c` | `bg-surface` / `bg-raised` | raised panels |
| `--border` | `#161d26` | `border-line`, `divide-line`, `bg-line` | separators, hover fills |
| `--border-soft` | `#26313f` | `border-line-soft` | composer rest border (replaces the undefined token from the audit) |
| `--text` / `--text-muted` | `#e6edf3` / `#8b9bab` | `text-fg` / `text-muted` | body copy / secondary copy |
| `--accent` | `#4cc2a5` | `text-accent`, `bg-accent`, `border-accent`, `outline-accent` | primary accent, focus, active states |
| `--danger` / `--danger-strong` | `#f07067` / `#c42b1c` | `text-danger` / `bg-danger-strong` | errors / window-close hover |
| `--warning` / `--syncing` | `#e0b050` / `#e3b341` | `text-warning` / `bg-syncing` | warning copy / syncing dot |
| `--record` / `--record-strong` | `#e5484d` / `#ff6b6b` | `bg-record` / `text-record-strong` | recording dot and mic pulse |
| `--focus-ring` | `rgb(76 194 165 / 18%)` | `var(--focus-ring)` in the composer focus shadow (one-off rule) | composer focus halo |
| `--backdrop` | `rgb(5 8 11 / 70%)` | `bg-backdrop` | settings/onboarding backdrop |
| `--font-ui` | Inter, Segoe UI, system | `font-sans` | UI chrome |
| `--font-code` | JetBrains Mono stack | `font-mono` | terminal, composer, tab labels, previews |

Measured geometry exposed as spacing utilities: `h-header` (35px), `h-tabbar` (38px), `h-footer` (28px), `h-composer` (120px), `max-w-tab` (220px). These numbers are the approved measurements, not arbitrary values.

Shared controls (Tailwind `@layer components`): `.btn`, `.icon-btn`, `.field`, `.field-sm` (compact 6px/8px form controls used by settings and onboarding), `.card`, plus the built-in `sr-only`. Everything else is composed from utilities in the component template.

Ownership and exceptions:
- Token values and shared controls: `apps/renderer/src/styles.css` only.
- Component CSS is limited to genuinely complex or platform-specific rules (window drag regions, keyframes, the animated mic pulse) and must not redefine palette colors.
- xterm keeps its own stylesheet (`@xterm/xterm/css/xterm.css`) and the `TERMINAL_THEME` object in `terminal-panel.ts`, which needs literal colors for the canvas renderer; those literals mirror the tokens above and are the only justified exception.
- Runtime terminal-font changes set `--font-code` on `:root` (`appearance-store.ts`); `font-mono` reads it, so no component needs a font literal.
