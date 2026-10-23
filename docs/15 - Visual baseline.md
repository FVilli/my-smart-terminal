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
| Header | 43 px (`#0a0d10`) |
| Tab bar | 40 px (active tab `#171e25`) |
| Terminal | ~672 px (`#171e25`) |
| Assisted input | ~86 px (`#222e3c`) |
| Footer | 28 px (`#212b38`) |
| Sidebar | 360 px at 1440 (25%), `#0a0d10` |
| Main accent | `#4cc2a5` |

## Target palette

| Token | Target | Notes |
| --- | --- | --- |
| `--terminal-bg` | `#171e25` | matches mock |
| `--tab-bg` | `#212b38` | inactive tab bar |
| `--tab-active` | `#384a5d` | active tab, full-height fill |
| `--input-bg` | `#222e3c` | assisted input |
| `--sidebar-bg` | `#000000` | sidebar |
| `--card-bg` | `#333333` | sidebar cards |
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

## Out of scope

The mock's top black strip may include the operating-system window chrome; do not reproduce title-bar controls inside the app. Preserve all functional English copy, accessibility labels and the 75/25 contract.
