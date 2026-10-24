---
title: "M16B - T02 - Transparent application icon"
type: task
project: smart-terminal
created: 2026-10-24
id: "M16B-T02"
milestone: "M16B"
depends_on: "M16A-T01"
deliverables: "Transparent-background app icon used by header, runtime window, packaging and README-adjacent assets"
---

# M16B - T02 - Transparent application icon

## Objective
Remove the opaque square background from the Smart Terminal icon while preserving the mark and its antialiasing.

## Constrained implementation
- Derive a transparent RGBA version from the current icon source, with edge-connected black background removed (flood fill/key) and enclosed dark artwork preserved.
- Produce 512×512 `docs/assets/icon.png` and `apps/desktop/build/icon-linux.png`.
- Use it in the new header icon and runtime/package icon; verify the transparent background visually and with PNG alpha checks.
- Do not alter the README logo or unrelated branding.

## Acceptance
Icon is RGBA with transparent corners and a clean alpha edge; no black square; Linux package uses it; header displays it without a background plate.

## Outcome
- Flood-fill/color-key removed the edge-connected opaque background while preserving enclosed artwork.
- 512x512 RGBA icon written to docs/assets/icon.png, apps/desktop/build/icon-linux.png and apps/renderer/public/icon.png; corners alpha 0 and center opaque.
