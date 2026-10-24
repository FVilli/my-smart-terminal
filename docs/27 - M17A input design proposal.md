---
title: "M17A input composer design proposal"
type: design
project: smart-terminal
created: 2026-10-24
status: proposed
---

# M17A input composer design proposal

**Status:** Proposed — awaiting user approval before M17B implementation.  
**Mockup:** [`mockups/M17A - Input.png`](../mockups/M17A%20-%20Input.png) · source [`mockups/M17A - Input.html`](../mockups/M17A%20-%20Input.html)

## Objective

Replace the current row of separately bordered controls with a VS Code/Codex/Claude-style **single composer container**: one thin rounded border around the text area and a bottom action row, with AI, microphone and send controls inside the border at bottom right.

## Reference evidence

VS Code's chat composer uses a single container (`input-background`), a 1 px border, radius tiers of 8 px for the outer surface, and a 22 px action row below the editor. Its controls are borderless ghost icons except the filled circular submit button. Claude Code/Codex use the same "prompt box/composer" vocabulary; no official pixel spec is published, so this proposal adapts the VS Code token system rather than claiming exact parity.

## Proposed geometry

| Element | Proposed value |
| --- | --- |
| Outer composer | 1 px border, **8 px radius**, `#222e3c`, full available width |
| Vertical rhythm | 10 px outer spacing, 8 px internal padding |
| Composer height | ~96–110 px total, targeting the current input footprint |
| Textarea | transparent, borderless, flexible height, monospace |
| Action row | 24–26 px, aligned bottom; 4 px gaps |
| AI control | 24 px borderless ghost: `✦ AI` |
| Microphone | 24 px borderless ghost icon |
| Send | 26 px filled circle, accent `#4cc2a5`, dark glyph |
| Hint | bottom-left, muted 11 px: `Enter sends · Shift+Enter newline` |
| Focus | accent border plus subtle 1 px ring |
| Disabled | muted controls, reduced opacity, textarea still readable |

The composer is full-width within the main column (minus 14–16 px side padding). Unlike chat sidebars, terminal command composition benefits from horizontal room; no 950 px chat cap is required.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ command text / draft                                         │
│                                                              │
│ Enter sends · Shift+Enter newline            ✦ AI  🎙  (↑)  │
└──────────────────────────────────────────────────────────────┘
```

- The outer border is the only visible box; textarea, AI, mic and hint have no individual borders.
- AI, mic and send are grouped at bottom right, inside the border.
- Send is the only filled control and represents the primary deliberate action.
- The AI control remains text+sparkle (`✦ AI`) so it is distinguishable from a generic magic icon.
- Notices for AI/STT appear below the composer without adding another bordered row inside it.

## Interaction contract (unchanged)

- Enter sends; Shift+Enter inserts a newline; IME composition Enter does not send.
- ArrowUp/Down move the caret; Tab traverses controls; Escape returns focus to the terminal without clearing the draft.
- AI remains explicit and reviewable; STT appends text without sending.
- Ctrl/Cmd+Shift+E focuses the composer; terminal keys remain untouched except the documented zoom exception.
- Drafts remain per session/tab.

The restyle must not alter these semantics.

## States

| State | Expected |
| --- | --- |
| Idle | Single border, muted hint, ghost AI/mic, enabled send only with draft |
| Focused | Accent border/ring, caret visible, controls accessible |
| Empty | Send disabled/muted; textarea placeholder visible |
| Recording | Mic accent/recording indicator; no auto-send |
| AI busy | AI control busy label; editable draft preserved |
| Error/notice | Message below composer; border does not fragment |
| Disabled | Session not running; editor and actions muted |

## Responsive behavior

- At 1440 px, full-width composer with controls at bottom right.
- At 1024 px, hint may truncate before controls; controls never overlap the editor or leave the border.
- At the 960 px minimum, AI/mic/send remain reachable and keyboard focus order is unchanged.

## Approval checklist

- [ ] Single 8 px rounded border replaces all separate control boxes.
- [ ] AI, mic and send are bottom-right inside the border.
- [ ] Send is the only filled primary control.
- [ ] Hint/voice status placement is acceptable.
- [ ] Focus/disabled/recording/error states are approved.
- [ ] Keyboard/AI/STT behavior remains unchanged.

No application code is changed by M17A.
