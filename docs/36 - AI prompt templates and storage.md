---
title: "AI prompt templates and storage"
type: spec
project: smart-terminal
created: 2026-10-26
---
# AI prompt templates and storage

This describes the implemented M23 AI action template system. The AI remains advisory: choosing an action composes prompts; explicit Send is required for a provider request.

## Local storage and limits

The main process stores action definitions in `userData/config/ai-actions.json`, schema version `1`. This is local configuration: templates are tooling preferences, not synchronized session data. Writes use a temporary file followed by rename and request mode `0600`. An unreadable/missing file yields defaults; malformed or invalid stored content falls back to defaults and includes the sanitized warning `Stored AI actions were invalid: defaults were loaded.`

Built-in IDs, titles, and descriptions are fixed. Their two templates can be edited/reset. Custom IDs use `custom-<slug>`; custom actions have a title, description and system/user templates, with intent rendered from the description. At most 20 actions are retained. Titles are limited to 60 characters, descriptions to 200, and each template to 8 KiB. Duplicate titles are rejected case-insensitively.

## Placeholder rendering

Templates are rendered in one substitution pass. Recognized placeholders are replaced; unknown `{{name}}` placeholders remain literal. Missing `os`, `shell`, and `envSource` values become `unknown`; other missing values become empty strings. Combined rendered system and user prompts are capped at 32 KiB.

| Placeholder | Value |
| --- | --- |
| `{{os}}` | Session operating system |
| `{{shell}}` | Session shell |
| `{{envSource}}` | Environment detection source |
| `{{terminalInfo}}` | Terminal/session information supplied by the active session |
| `{{console}}` | On-demand console excerpt |
| `{{composer}}` | Current composer text |
| `{{action}}` | Action title |
| `{{intent}}` | Action description (custom action intent) |
| `{{description}}` | Action description |

Console text is collected on demand from the active xterm buffer: the last 200 lines, further bounded to 8000 characters. It is not persisted; provider submission still requires the user's explicit Send action.

## Built-in templates

Five defaults are defined in `packages/ai/src/action-templates.ts`; rendered by `packages/ai/src/placeholders.ts`.

| ID / title | Default purpose |
| --- | --- |
| `suggest-command` / Suggest a command | Produce one OS/shell-appropriate command and short explanation. |
| `explain-command` / Explain a command | Explain effects, scope and data-loss risks without inventing commands. |
| `assess-risk` / Assess risk | Report risk, rationale, reversibility, privileges and safer alternative; advisory only. |
| `fix-message` / Fix message for agent | Correct typos while preserving technical tokens and meaning. |
| `rewrite-dictated` / Rewrite dictated message | Make a voice transcript concise and clear without changing intent. |

## Editing and security

The AI Actions manager is opened from the header wand in its own modal; it is separate from the composer AI assistant modal. Its bordered list footer shows `BUILT-IN:n CUSTOM:n` counts. Built-in templates can be reset per action. Custom actions can be deleted only after confirmation; bulk Reset has been removed. The AI Actions manager and AI Assistant are separate modal surfaces. In the assistant, an action select composes two editable prompts; the answer is shown as rendered Markdown with a Raw view escape hatch. Editing the System prompt is supported; it is not an immutable system instruction. Main blocks detected secrets in either submitted prompt before provider access. This UI change does not alter prompt or answer persistence: neither is persisted or logged by this feature. A secret-filter match blocks the call; filtering should not be treated as a guarantee of detection for every secret format.
