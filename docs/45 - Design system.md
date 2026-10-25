---
title: "Design system"
type: design
project: smart-terminal
created: 2026-10-27
---

# Renderer design system

## Overview

This CSS-first design system provides consistent controls and panel anatomy without a component-library dependency. Its goals are predictable spacing, theme-aware color, reusable accessible patterns, and easy-to-review templates.

It is not a replacement for Angular components, a complete visual language for every screen, or permission to abstract one-off layouts. Layout remains local to feature templates unless a genuine repeated pattern merits a primitive.

[`apps/renderer/src/styles.css`](../apps/renderer/src/styles.css) is the single source of truth for semantic tokens and shared primitives. Components consume those classes alongside Tailwind utilities: primitives own repeated visual behavior; utilities own local arrangement and one-off dimensions. Avoid duplicate component CSS.

Related references: [coding rules](29%20-%20Coding%20rules.md), [Angular conventions](30%20-%20Angular%20conventions.md), [comments and documentation policy](31%20-%20Comments%20and%20documentation%20policy.md), [visual baseline](15%20-%20Visual%20baseline.md).

## Tokens

Token values are defined in `styles.css`, not repeated in templates or component styles. Tailwind names below are generated semantic utilities from `@theme inline`.

| Group | Source tokens / utilities | Purpose |
|---|---|---|
| Surface | `--bg` / `bg-app`, `--terminal-bg` / `bg-terminal`, `--tab-bg` / `bg-tab`, `--input-bg` / `bg-input`, `--sidebar-bg`, `--card-bg` / `bg-card`, `--surface` / `bg-surface`, `--surface-raised` / `bg-raised`, `--backdrop` / `bg-backdrop` | Page, terminal, navigation, control, card, raised and overlay surfaces. |
| Line | `--border` / `border-line`, `--border-soft` / `border-line-soft` | Standard and subtle separators/borders. |
| Text | `--text` / `text-fg`, `--text-muted` / `text-muted` | Primary readable content and supporting/de-emphasized content. |
| Accent | `--accent` / `text-accent`, `--focus-ring` | Selected/action emphasis and keyboard focus. |
| Danger | `--danger` / `text-danger`, `--danger-strong` / `text-danger-strong` | Validation and destructive/error state emphasis. |
| Warning | `--warning` / `text-warning`, `--syncing` / `text-syncing` | Caution and synchronization state. |
| Record | `--record` / `text-record`, `--record-strong` / `text-record-strong` | Recording state and stronger recording indication. |

Dark values are declared at `:root`; light mode overrides semantic values under `:root[data-theme='light']`. Use the same token/utility in both themes; never branch a component on theme or introduce palette literals. Typography is `--font-ui`/`font-sans` and `--font-code`/`font-mono`.

## Rhythm and geometry

| Primitive/value | Actual value | Use |
|---|---:|---|
| `.form-field` gap | Tailwind `1.5` (0.375rem) | Label/control/help relationships within one field. |
| `.form-stack` gap | Tailwind `3` (0.75rem) | Separation between sibling fields. |
| `.form-label` | 13px, medium, line-height 1.35 | Field name; do not mimic with ad-hoc margin/size classes. |
| `.form-help`, `.form-error` | 11px, normal, line-height 1.35 | Supporting instruction or validation message. |
| `.field-counter` | 10px, normal, line-height 1.2, right aligned | Character/count metadata adjacent to a control. |
| `.field` padding | `px-2.5 py-2` | Default comfortable text input/select/textarea control. |
| `.field-sm` padding | `px-2 py-1.5` | Compact controls where surrounding density requires it. |
| `.panel-header` | `p-3`, horizontal gap 4, vertical gap 1 | Flexible wrapping panel heading and tools. |
| `.panel-footer` | `p-3`, gap 2 | Right-aligned panel actions. |
| `.btn` | `px-2.5 py-1.5`, gap 1.5 | Labeled action and its optional icon. |

Prefer Tailwind's spacing scale for other gaps. Measured chrome geometry (`h-header`, `h-tabbar`, `h-footer`, `h-composer`, `w-tab`) is defined centrally and documented in [visual baseline](15%20-%20Visual%20baseline.md); do not infer or re-specify it here. Primitives use existing rounded-md/rounded-sm treatments rather than a new radius scale.

## Component catalogue

Use the following shared class contracts from `styles.css`. Keep component-specific layout utilities in templates and do not add new meanings to a primitive locally.

### Forms

| Primitive | Purpose and anatomy | Do | Don't |
|---|---|---|---|
| `.form-field` | Min-width-safe vertical wrapper; label, control, optional help/error. | Wrap each independent field. | Put unrelated fields in one wrapper. |
| `.form-label` | 13px medium field label. | Associate with control by `for`/`id`. | Replace with arbitrary label margins or omit the association. |
| `.form-help` | Muted supporting text. | Explain expected value or consequence. | Use as the only indication of an error. |
| `.form-error` | Danger-colored validation text. | Link via `aria-describedby`; announce changes when appropriate. | Rely on color alone. |
| `.form-stack` | Vertical group of fields at gap 3. | Apply to the container grouping fields. | Add per-field margins that fight the stack rhythm. |
| `.field` | Full-width standard control; border, card surface, `px-2.5 py-2`. | Use for regular text controls. | Recreate its border/padding with literals. |
| `.field-sm` | Full-width compact control; input surface, `px-2 py-1.5`. | Use for intentionally dense interfaces. | Use merely to shrink an otherwise crowded form. |
| `.field-counter` | Right-aligned muted count below/near its control. | Keep count understandable and update accessibly. | Use as a label or error. |

Angular template example (retain existing stable test identifiers where present):

```html
<div class="form-field">
  <label class="form-label" for="display-name">Display name</label>
  <input id="display-name" class="field" data-testid="display-name" />
  <p class="form-help" id="display-name-help">Shown in this workspace.</p>
</div>
```

### Actions and panels

| Primitive | Purpose and anatomy | Do | Don't |
|---|---|---|---|
| `.btn` | Labeled action with built-in icon/label gap, hover, disabled and focus-visible styling. | Use for actions with visible text. | Add redundant icon spacing or remove focus treatment. |
| `.icon-btn` | Compact icon-only interactive button with hover/disabled/focus behavior. | Provide `aria-label`, native button semantics and decorative SVG. | Use a clickable `<span>` or unlabeled icon. |
| `.card` | Bordered card surface with standard internal padding and bottom spacing. | Use for repeated card content. | Nest cards just to obtain padding. |
| `.panel-header` | Flexible wrapping, non-shrinking header row with border and padding. | Place title and optional tools here. | Hard-code header height into the primitive. |
| `.panel-title` | Semibold base-size panel heading. | Use for the panel's heading. | Use as a generic text-size utility. |
| `.panel-footer` | Non-shrinking right-aligned action row, border and padding. | Put panel-level actions here. | Put scrolling content in the footer. |

Icon-only button example:

```html
<button class="icon-btn" type="button" aria-label="Close" data-testid="close-panel">
  <svg aria-hidden="true" viewBox="0 0 16 16"><path d="..." /></svg>
</button>
```

Panel anatomy:

```html
<section class="flex min-h-0 flex-col" aria-labelledby="editor-title">
  <header class="panel-header">
    <h2 id="editor-title" class="panel-title">Editor</h2>
    <button class="icon-btn" type="button" aria-label="Close" data-testid="close-editor">
      <svg aria-hidden="true" viewBox="0 0 16 16"><path d="..." /></svg>
    </button>
  </header>
  <div class="min-h-0 flex-1 overflow-y-auto p-3">Panel content</div>
  <footer class="panel-footer"><button class="btn" type="button">Save</button></footer>
</section>
```

The SVG path is illustrative only; use the repository's existing icon markup. The `data-testid` values in examples illustrate stable selectors, not a requirement to invent test hooks for every element.

## Layout patterns

- **Settings form column:** use a local `max-w-*` and `form-stack`; each child is a `form-field`. Keep actions outside the field stack when they are section-level actions.
- **Modal/panel with scrollable body:** flex column with `min-h-0`; header and footer use the panel primitives, while body owns `flex-1 overflow-y-auto`. Set the outer height/maximum height in the owning layout.
- **Full-height editor:** use a two-row template grid such as `grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]`; keep header in row one and independently scrollable content in row two. Add footer as a flex-column pattern where needed rather than forcing it into the two-row grid.
- **Toolbar with label and segmented controls:** use a flex/wrapping utility row, label the group in readable text, and represent Answer / Rendered / Raw as mutually exclusive buttons with clear selected state (`aria-pressed`).
- **Action row:** group related compact controls in a flex row with a consistent utility gap; each icon action is a native button with an accessible name and decorative icon. Use `.btn` if visible text is present.

## Accessibility and testing

Associate every visible label with its control using matching `for` and `id`. Connect help/error text with `aria-describedby`; dynamic validation should use an appropriate live announcement (for example `aria-live="polite"`) without making static content noisy. Use `role="status"` for concise status updates where the content is a status message.

All interactive controls must be keyboard operable and retain visible `:focus-visible` indication. Toggle/segmented buttons expose state with `aria-pressed`; do not communicate selection only by color. Icon-only controls require an `aria-label` (or equivalent accessible name); decorative SVGs use `aria-hidden="true"`.

Keep `data-testid` values stable when markup changes. Add hooks only where automation needs a reliable selector; changing an established id requires updating its consumer/tests. Dialogs and overlays must support expected keyboard behavior, including Escape where appropriate, and return focus to the invoking control when dismissed. Ensure focus is not lost behind a modal and that keyboard order follows the visible interface.

## Migration guide

Convert an ad-hoc block such as `<label class="mt-2.5 ...">` and its control to one `.form-field` wrapper: remove spacing/typography classes that duplicate the primitive; add `.form-label`; give the control a stable `id` and existing appropriate `.field`/`.field-sm`; connect helper/error text; and use `.form-stack` at the parent when grouping fields. Keep unrelated layout utilities (width, grid placement, responsive behavior) local.

Migration checklist:

1. Preserve the control's behavior, binding, validation and existing `data-testid`.
2. Make label association explicit; preserve help/error semantics and described-by references.
3. Replace palette literals and duplicated padding/type rules with tokens/primitives.
4. Check compact versus standard control density and keyboard focus in both themes.
5. Verify narrow layouts, wrapping, status announcements and automated selectors.

Legacy provider/config fields: distinguish **UI migration** (presentation may adopt these primitives) from **contract migration** (provider identifiers, persisted values, defaults, validation meaning or IPC shapes). A visual cleanup does not authorize changing stored/config/API contracts. Preserve saved legacy values and behavior unless a separately approved contract change says otherwise; consult [AI provider setup](19%20-%20AI%20provider%20setup%20guide.md) for the documented provider workflow.

## Governance and adoption

Add a shared primitive only under the rule of three: a coherent pattern has appeared independently at least three times and the shared class materially removes duplication. Keep one-off layout in utilities. Before adding a primitive, inspect current usage and identify ownership and accessibility behavior.

Token changes belong in `styles.css`: update dark and light semantic values together, retain token intent, inspect generated utility naming, and verify key screens in both themes. Do not add raw palette values in templates/component styles or create competing token sources.

Review checklist: semantic token only; both themes considered; keyboard focus and disabled/selected states intact; labels/names/status accessible; responsive layout and scrolling work; stable test ids preserved; no unrelated contract changes; links and examples remain accurate.

Current adoption (observed in the renderer styling work): AI Assistant; AI Actions manager and settings; Settings AI/STT provider fields. Adoption is incremental, not universal. Remaining legacy areas include older settings/provider/config templates and bespoke one-off controls/panels; migrate them opportunistically without changing their contracts. Treat this list as a scoped snapshot, not a claim that every field in those screens is converted.

### Batch 2 primitives

- Composer controls and icon geometry now use semantic composer/icon tokens.
- Sidebar tabs, status messages, and repeated entry rhythm use shared primitives.
- AI modal shells and compact markdown controls consume centralized geometry/typography tokens.

### Batch 3 adoption guard

- Remaining app-template design literals were replaced with semantic typography, rhythm, focus-shadow, and audio-control tokens; structural dialog/layout constraints remain explicit exceptions.
- `tests/renderer-style-guard.spec.ts` rejects arbitrary typography, spacing, radius, opacity, shadow, and small icon/button dimensions while documenting the current structural allowlist.
