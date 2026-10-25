---
title: "M24 - T01 - Fix the GitHub guide links"
type: task
project: smart-terminal
created: 2026-10-25
id: "M24-T01"
milestone: "M24"
depends_on: "M23"
deliverables: "Validated help opening with clipboard fallback, structured result and tests/smoke"
---

# M24 - T01 - Fix the GitHub guide links

## Objective
Make every settings help button useful even when the OS cannot open a browser, and remove the generic failure message.

## Implementation
- Main `help-topics.ts`: keep the closed `HELP_URLS` map; add `isAllowedHelpUrl(url)` (https, host github.com, path prefix `/FVilli/my-smart-terminal/blob/main/docs/`) and `helpDocument(topic)` returning `{ url }` or throwing a coded error for unknown topics.
- Main help gateway: `open(topic)` → validate, `await shell.openExternal(url)` with `{ activate: true }`; on rejection return `{ opened: false, url }` (sanitized reason category only, no stack), otherwise `{ opened: true, url }`. Contract: `HelpOpenResult`.
- Renderer: on `opened: false`, copy the URL with `clipboardWrite` and show an info message "Could not open a browser: guide link copied to the clipboard." (no generic error); on success no message. Keep the existing `settings-github-help` test id and label.
- Tests: URL allowlist/unknown topic; gateway result on success/failure with an injected `openExternal`; renderer copy-fallback path.
- Smoke: in the Xvfb environment there is no default browser, so assert the clipboard receives the guide URL and the message is shown (not the old error).

## Acceptance
- All four topics resolve to allowlisted HTTPS URLs; failure yields a copied link and a clear message; no behaviour change for the terminal.
