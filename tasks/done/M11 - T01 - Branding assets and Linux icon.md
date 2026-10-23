---
title: "M11 - T01 - Branding assets and Linux icon"
type: task
project: smart-terminal
created: 2026-10-23
id: "M11-T01"
milestone: "M11"
depends_on: "M10"
deliverables: "512x512 Linux installation icon, README logo asset, Linux packaging icon configuration and README branding"
---

# M11 - T01 - Branding assets and Linux icon

## Objective
Turn the two supplied PNGs into a clean installation icon and README logo, and make Linux packages use the new icon without changing macOS/Windows branding.

## Constrained implementation
- Source assets: `docs/assets/icon-brain-more-stylized.png` (1254x1254 RGB) and `docs/assets/logo-and-icon-concept-sheet.png` (1881x836 RGBA; left logo panel bbox ~144,16-1032,816; right icon panel ~1240,224-1664,656).
- Generate `docs/assets/icon.png` as a square 512x512 PNG from the icon source (preserve the intended artwork, no distortion).
- Generate `docs/assets/logo.png` by cropping the left logo/lockup panel from the concept sheet; preserve transparency and readable proportions for README.
- Copy the generated icon to `apps/desktop/build/icon-linux.png`; set `linux.icon: icon-linux.png` in electron-builder.yml. Leave `apps/desktop/build/icon.png` untouched for macOS/Windows.
- Replace README's header image with `docs/assets/logo.png`, with meaningful alt text and responsive width. Keep the M10 installation section exactly three guide links.
- Do not reintroduce the four deleted legacy PNGs.

## Acceptance criteria
- `docs/assets/icon.png` is 512x512; `docs/assets/logo.png` is non-empty, transparent/appropriate for the README, and visually based on the left panel.
- Linux package config points to the new icon; macOS/Windows config unchanged.
- README logo loads locally; installation section unchanged.
- No new dependencies; no app behavior changes; English-only.

## References
docs/20-22; README; electron-builder.yml; docs/assets.

## Do not
Do not modify install scripts or release artifacts in this task; do not touch macOS/Windows icon settings.

## Outcome
- Generated `docs/assets/icon.png` (512x512) from `icon-brain-more-stylized.png` and `apps/desktop/build/icon-linux.png`.
- Cropped the left lockup panel from the concept sheet, resized to 600x542, saved as `docs/assets/logo.png` with transparency.
- `electron-builder.yml` Linux icon now uses `icon-linux.png`; macOS/Windows icon settings unchanged.
- README header uses the new logo with responsive width/alt text; installation section unchanged.
- Verified dimensions, non-empty pixels, transparency on the logo, and Markdown links.
