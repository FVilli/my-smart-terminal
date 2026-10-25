---
title: "M29 - Minimal design system and AI surface fixes"
type: milestone
project: smart-terminal
created: 2026-10-25
id: "M29"
goal: "Introduce a small, documented design system (form fields, labels, panels, counters, buttons) and use it to fix the remaining AI settings/assistant layout issues and model filtering."
depends_on: "M28"
---
# M29 - Minimal design system and AI surface fixes

## Fixed decisions
- The design system is CSS-first: semantic tokens already in `styles.css` plus a small set of `@layer components` primitives (`form-field`, `form-label`, `form-help`, `form-error`, `form-stack`, `field-counter`, `panel-header`, `panel-title`, `panel-footer`, `btn`/`btn-icon`). No new dependency and no second token source.
- Settings/AI model select has no Custom entry: Provider default, discovered chat models, and the saved value only when it is no longer listed. Audio/transcription model ids are excluded from AI discovery; STT discovery keeps only audio/transcription ids.
- AI Actions left list and right editor both fill the modal height; labels sit at a consistent distance from fields (form primitives) and the two template editors grow to use the available height.
- AI Assistant uses the same form primitives: the AI action label/select follow the system spacing, and the answer pane (Markdown view or raw textarea) fills the full height between the toolbar and the footer.
- No behaviour, security, contract or test-id regressions.

## Acceptance
- A short design-system doc exists with primitives, spacing and usage rules; AI Actions/Settings/AI Assistant use them instead of ad-hoc label classes.
- Model lists behave per the rules above; layouts fill their height at 1440×900/1024×700 and zoom.
- Tests/smokes/screenshots/docs updated; independent review recorded.

## Tasks
T01 primitives + docs → T02 AI Actions layout + assistant alignment → T03 settings fields + model filtering + verification.
