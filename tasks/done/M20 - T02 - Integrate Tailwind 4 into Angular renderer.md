---
title: "M20 - T02 - Integrate Tailwind 4 into Angular renderer"
type: task
project: smart-terminal
created: 2026-10-24
id: "M20-T02"
milestone: "M20"
depends_on: "M20-T01"
deliverables: "Pinned Tailwind 4 build integration and minimal global stylesheet"
---
<!-- gsynchro:v1 id=643a7688-6a45-4c51-9f6c-aacb8f4bfa3d registered=2026-10-24T17:27:33.985Z -->

# M20 - T02 - Integrate Tailwind 4 into Angular renderer

## Objective
Enable Tailwind 4 in the current Angular renderer toolchain without adding a second bundler.

## Implementation
- Inspect installed Angular builder compatibility and follow the supported Tailwind 4 PostCSS integration for that version; pin exact versions in root lockfile.
- Add only the required Tailwind/PostCSS dependencies and configuration; ensure Angular compilation scans component templates and styles.
- Import Tailwind once in the renderer global style entry, preserving existing functional CSS during migration; keep `@xterm/xterm/css/xterm.css` functional.
- Define build checks for development and production; no CDN, JS runtime styling engine or Electron security changes.

## Acceptance
Existing app renders; sample Tailwind utility is emitted in production build; xterm cursor, selection and resizing still work; typecheck, lint and build pass.
