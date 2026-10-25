---
title: "M23 - T05 - Settings template and custom action editor"
type: task
project: smart-terminal
created: 2026-10-25
id: "M23-T05"
milestone: "M23"
depends_on: "M23-T04"
deliverables: "AI actions settings tab to edit/reset templates and add/delete custom actions"
---

# M23 - T05 - Settings template and custom action editor

## Objective
Give users full control of templates and custom actions from Settings.

## Implementation
- Add an **AI actions** settings tab (fifth tab) with a list of actions (built-in/custom), editor for the selected action: title/description (custom only), System and User template textareas with placeholder reference and validation errors, Save, Reset (built-ins), Delete (custom), Add action (name + description, default templates).
- Wire to the T01 store through IPC; show sanitized errors, unsaved-changes confirmation consistent with the settings dialog, and keep the fixed-height dialog model.
- Validation: placeholders (warn unknown), lengths, max 20 actions, slug ids, duplicate titles rejected.
- Tests for editor validation/save/reset/delete and the settings smoke extended to edit a template and add/remove an action.

## Acceptance
- Changes persist locally, apply to the modal immediately, and cannot break the settings layout or dialog height.
