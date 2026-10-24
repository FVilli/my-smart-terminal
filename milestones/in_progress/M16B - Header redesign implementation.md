---
title: "M16A header design proposal"
type: design
project: smart-terminal
created: 2026-10-24
status: proposed
---

# M16A header design proposal

**Status:** Proposed — awaiting user approval before M16B implementation.  
**Mockup:** [`mockups/M16A - Header.png`](../mockups/M16A%20-%20Header.png) · source [`mockups/M16A - Header.html`](../mockups/M16A%20-%20Header.html)

## Objective

Replace the 48 px in-column app header with a VS Code-inspired **full-window title bar**. Session tabs move directly under it, and the native-width window controls are available on the right on Linux/Windows.

## Reference evidence

VS Code's current source sets a custom title bar of **35 px with a Command Center**, 22 px title-bar controls and 4 px control gaps. Its tabs are commonly 35 px (compact 22 px; modern UI variants 32/28 px). These are references, not a requirement to copy every VS Code setting.

## Proposed geometry

| Element | Proposed value | Notes |
| --- | --- | --- |
| App title bar | **35 px**, full window width | Replaces the current 48 px header; spans main column and sidebar |
| Left app icon | 18×18 px inside 35×35 px hit area | Transparent-background Smart Terminal icon (M16B-T02) |
| Centre title | `Smart Terminal - Version <runtime version>` | Dynamically supplied by app metadata; mockup uses 1.2.2 |
| Header control buttons | 22×22 px, 4 px gaps | Gear and layout toggles |
| Window controls | 46×35 px each | Minimize, maximize/restore, close |
| Session tabs | **38 px** | Exactly 30% below the current 54–55 px, rounded to 38 px |
| Tab close button | 20×20 px | Keep keyboard accessible |
| New-session button | 38×38 px | Same height as the tab strip |
| Sidebar | 25% | Existing 75/25 split retained when visible |

At 1024 px width the centre title gets priority; right controls remain reachable. At the 960 px minimum, the title may truncate but must not overlap controls.

## Header zones

```
[ app icon ]              Smart Terminal - Version 1.2.2              [History] [Clipboard] [gear] | [_] [□] [×]
```

- No File/Edit/View/Window menu.
- Left: app icon only.
- Centre: app name and runtime version.
- Right: History/Clipboard panel toggles, Settings gear, then Linux/Windows window controls.
- On macOS: native traffic lights remain at the left; the centre/right controls stay, and the custom `_ □ ×` trio is not duplicated.

## Panel toggles

History and Clipboard are two independent surface choices, not separate implementations of the same toggle:

- Click **History**: select and show the right panel on History; History button is active.
- Click **Clipboard**: switch the panel to Clipboard; Clipboard button is active.
- Click the already-active button: hide the right panel; both buttons become inactive.
- Clicking a hidden panel's button opens it again.
- When visible, the panel keeps the existing 75/25 layout. When hidden, the main terminal expands to the full width.
- The existing sidebar tabs remain as an alternate selector inside the panel; header buttons and internal tabs must stay in sync.

Buttons are accessible toggles with `aria-pressed`, visible focus rings and tooltips. The active state uses the existing accent tint, not a new color.

## Window controls and custom frame

The `_ □ ×` controls require a frameless/custom title bar on Linux/Windows. This is a platform behavior change, not only styling:

- Minimize, maximize/restore and close use narrow IPC actions with sanitized arguments.
- Double-clicking the drag region toggles maximize.
- The drag region excludes every button and the settings/panel controls.
- Maximize state is reflected by the restore icon and accessible label.
- Window resizing must remain native and reliable.
- Keyboard access and focus order must include the controls.
- On macOS keep native traffic lights and use the platform menu/behavior.

If the custom-frame path cannot preserve reliable resizing/dragging on Linux, stop M16B and return to this design rather than silently switching to a different window model.

## Tab strip

- Move directly under the title bar in the main column; remove the old brand/hint/gear row.
- Height **38 px** (current 54–55 px; 30% reduction).
- Active tab keeps the `#384a5d` fill; inactive tabs use the current tab background with restrained contrast.
- Keep existing session label, target, close and plus semantics.
- Target and close affordances must remain usable at 1024 px.

## Visual tokens

Use existing app palette: `#171e25` titlebar/terminal, `#212b38` tabs, `#384a5d` active tab, `#222e3c` input/cards, `#161d26` borders, `#4cc2a5` accent, `#e6edf3` text, `#8b9bab` muted text. No new accent color.

## States to review

| State | Expected |
| --- | --- |
| History active | History control tinted; Clipboard neutral; panel visible on History |
| Clipboard active | Clipboard control tinted; History neutral; panel visible on Clipboard |
| Panel hidden | Both controls neutral; terminal expands; no empty sidebar gap |
| Hover/focus | Subtle surface/focus ring; no layout shift |
| Maximized | Restore icon/label replaces maximize |
| Narrow window | Centre title truncates safely; controls never overlap |

## Approval checklist

- [ ] 35 px full-window title bar and 38 px tabs are the desired proportions.
- [ ] Icon left, centred name/version, no menu.
- [ ] History/Clipboard active-hide behavior is correct.
- [ ] Linux/Windows `_ □ ×` and macOS traffic-light split is accepted.
- [ ] Custom-frame consequences are accepted for M16B.
- [ ] Palette and tab density are approved.

M16B also replaces the opaque square icon background with a transparent RGBA asset.

No application code is changed by M16A.


## Extra deliverable
- Transparent-background application icon (M16B-T02).
