---
title: "M24 - Settings usability and AI actions UI"
type: milestone
project: smart-terminal
created: 2026-10-25
id: "M24"
goal: "Fix the settings regressions (help links, dialog width, tab structure, token feedback, STT labels/controls) and align the AI actions editor with the established component, card and confirmation patterns, while scoping appearance customization through analysis and design."
depends_on: "M23"
---

# M24 - Settings usability and AI actions UI

## Fixed decisions
- **Help links**: main validates the closed URL allowlist, opens via `shell.openExternal`, and on failure copies the URL to the clipboard and returns a structured result so the renderer can say "link copied" instead of failing silently. No renderer-side URL construction.
- **Dialog width**: the settings dialog grows by at least 60% (min width ~832 px, max 92vw) while keeping the fixed height and internal scrolling; verified at 1440×900 and 1024×700 plus zoom 50–200%.
- **Tabs**: one reusable standalone `TabsContainer` component (accessible tablist, roving focus, `role=tab`/`aria-selected`, slot-per-panel) replaces the hand-written settings tab row; the visual style matches the Clipboard/History tabs and uses M20 tokens. Onboarding keeps its 3-step flow; edit mode uses the five settings tabs.
- **Token feedback**: the AI token field stays `type=password`; when a token exists and the field is empty it shows a masked placeholder and a hint "Token stored — type to replace". The token is never read back into the renderer.
- **STT**: the first label reads "Speech to Text provider"; the refresh-models button is exactly the same height as the adjacent model select.
- **AI Actions**: the action list uses the history/clipboard card pattern; the list footer has `+` (add) and `Reset` (with confirmation) controls. `Reset` restores built-in templates to defaults and leaves custom actions untouched; the confirmation states that.
- **Appearance**: only the terminal monospace font is configurable for now. Discovery (T07), design incl. light/dark theme (T08) and implementation of the approved set (T09) are separate tasks; T09 implements only what T08 approves.
- Frontend work is componentized, uses the shared primitives/tokens (`btn`, `field`, `card`, M20 tokens), keeps DOM/test ids for smokes, and follows docs/29–31.

## Non-goals
Sync of templates, per-action model selection, streaming, new providers, changing PTY/IPC contracts unrelated to help-open, visual redesign beyond the settings surfaces.

## Acceptance
- Every GitHub guide opens or, when the OS cannot open a browser, the link is copied and the UI says so; no generic failure message.
- Settings dialog ≥60% wider, tabs behave as one accessible tablist, token/STT fixes visible, AI Actions list uses cards with + / Reset+confirm.
- Appearance analysis and design documents exist; T09 implements exactly the approved options (light/dark + font at minimum) with tests and visual evidence.
- Lint, typecheck, tests, build, layout/zoom, screenshots and smokes pass; no dependency changes.

## Task sequence
T01 help links → T02 dialog width/responsive → T03 TabsContainer + migration → T04 token mask → T05 STT label/refresh height → T06 AI Actions list/footer/confirm → T07 Appearance scouting (scout + oracle) → T08 Appearance design → T09 Appearance implementation of the approved set.

T07 can run in parallel with T01–T06 (read-only, docs only); T08 follows T07; T09 follows T08 and the settings tasks.
