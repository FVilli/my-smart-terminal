---
title: "M23 - AI prompt templates and custom actions"
type: milestone
project: smart-terminal
created: 2026-10-25
id: "M23"
goal: "Let users choose an AI action from a select, review and edit full System/User prompts with terminal context, and manage templates and custom actions from Settings, without enabling execution or persistence of prompts."
depends_on: "M22"
---

# M23 - AI prompt templates and custom actions

## Purpose
M22 shipped five fixed actions with an editable prompt body. Users need to own the prompt text, include terminal context, and add their own actions. M23 replaces the radio list with a select, exposes **System Prompt** and **User Prompt** as two editable textareas, and adds a Settings editor for templates and custom actions.

## Fixed decisions
- **Modal input**: one native `<select>` lists built-in and custom actions (title + description). Changing the selection re-composes both prompts.
- **Two prompts**: the modal shows `System Prompt` and `User Prompt` textareas, both editable and both sent exactly as displayed. A short non-editable security note in the dialog states that nothing is executed.
- **Console context**: the active terminal's visible scrollback (last 200 lines, max 8 000 characters, ANSI-free via xterm) is available as `{{console}}` and is included in the default system template. It is sent only on explicit Send and never persisted or logged.
- **Placeholders** (validated in Settings, unknown ones left literal with a warning):
  `{{os}}`, `{{shell}}`, `{{envSource}}`, `{{terminalInfo}}` (session · kind · os · shell), `{{console}}`, `{{composer}}`, `{{action}}` (title), `{{intent}}` (description), `{{description}}`.
- **Templates and custom actions are local configuration** (`userData/config/ai-actions.json`, atomic writes, schema version): they are tooling preferences, not synchronized session data. Built-in ids and titles are fixed; their templates are editable and resettable. Custom actions add a name, a description used as intent, and both templates; limit 20 actions total.
- **Security**: prompts are sent to the provider only on Send; the secret gate in main still blocks before any network call; templates containing secrets are stored locally, never synced. Shell-command execution and auto-submit remain impossible.
- **Backward compatibility**: existing users start from the current five actions and M22 default wording; the legacy `ai:compose`/`ai:action` shapes are replaced by the new two-prompt contracts, with the renderer and tests migrated together.

## Non-goals
Streaming, conversation history, provider changes, model selection per action, synced templates, AI tool/function calling, template import/export.

## Acceptance
- Select-driven modal with editable System/User prompts; both rendered from stored templates and placeholders.
- Terminal console text available and bounded; never persisted/logged; secret gate preserved.
- Settings editor: edit/reset the five built-in templates, add and delete custom actions with name/description/templates.
- Validation for templates, placeholders, ids, lengths and limits; corrupt config falls back to defaults with a sanitized warning.
- No execution/deployment change; M20 visual baseline preserved; lint, typecheck, unit, build, smokes, layout and docs green.

## Task sequence
T01 contracts + template store → T02 placeholder engine + compose/action refactor → T03 terminal console capture → T04 select-driven two-prompt modal → T05 settings editor and custom actions → T06 docs/screenshots → T07 verification and independent review.
