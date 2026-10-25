---
title: "M24 verification audit"
type: audit
project: smart-terminal
created: 2026-10-25
---
# M24 verification audit

Final audit for milestone M24 (settings usability, AI actions UI and appearance themes). Range: M23 close (`315516b`) → M24 close; 52 files (docs/screenshots included); no dependency or lockfile change.

## Deliverables

| Task | Outcome |
| --- | --- |
| T01 | Help links: closed URL allowlist in main, `shell.openExternal` with sanitized failure result, renderer copies the URL and says so, test seam `SMART_TERMINAL_HELP_FORCE_FAILURE`, settings smoke coverage. |
| T02 | Edit-mode settings dialog is 60% wider (`min(832px, 92vw)`) with fixed height/internal scroll; capture metric + smoke width assertion; docs/15 updated. |
| T03 | Reusable accessible `TabsContainer` (tablist/tab roles, roving focus, arrow/Home/End, disabled skipping, active indicator, configurable label) plus pure reducer/`SETTINGS_TABS` metadata; settings tabs migrated with stable ids; dialog body is the tabpanel. |
| T04 | AI token field keeps `type=password`, shows a masked placeholder and an `aria-describedby` hint when a token is stored and the field is empty; AI setup smoke saves/reopens to prove it. |
| T05 | First STT label is “Speech to Text provider”; the model refresh control shares the select's stretched row and matches its height (31 px both) with smoke geometry. |
| T06 | AI Actions list uses history/clipboard-style cards; footer has `+` and `Reset`, where Reset opens an inline confirmation and restores only the five built-ins (custom actions kept); smoke confirms cancel/confirm. |
| T07 | Oracle-guided scouting (`docs/38`) with an options/risk matrix and the approved minimum set. |
| T08 | Executable design (`docs/39`): dark default, local `terminal_theme`, complete light token table, per-theme xterm palettes, pre-paint application, settings control, acceptance/test plan. |
| T09 | Implementation: theme config/validation/serialization, unchanged dark tokens + `[data-theme='light']` palette, per-theme xterm palettes with live updates, startup `--smart-terminal-theme`/`initialTheme`, Theme control with preview and save/cancel restore, dual-theme capture checks, `11-terminal-light.png`, docs updates. |

## Verification matrix

| Gate | Result |
| --- | --- |
| `npm run lint`, `npx tsc -p tsconfig.json --noEmit` | pass |
| `npx vitest run` | 49 files, 473 tests pass |
| `npm run build` | pass |
| Documentation links / consistency / installation guides | pass |
| `npm run test:layout` | 4 OK: dark and light at 1440×900 and 1024×700, theme-specific exact colours, no overflow |
| Zoom 50/100/200 | ratio preserved, no overflow |
| Screenshot harness | 11/11 OK (`11-terminal-light` deterministic across runs; only the known onboarding temp path and a small modal text antialias differ) |
| Electron smokes | AI, settings (theme preview/discard/save + AI actions card/reset), AI setup (token mask), STT setup (label/height), onboarding, IPC, PTY, sidebar, clipboard, search — `ok:true` |
| Packaging | not re-run in this milestone (no packaging-affecting change); previous M23 deb checks remain valid |

## Behaviour and security notes

- Help links are never built in the renderer; a failed browser launch copies the main-approved GitHub URL and shows an informational message. Real browser launch remains environment-dependent and is a manual check.
- The stored token is never read into renderer state; the mask is a placeholder with a conditional `aria-describedby` (only when the hint exists).
- Tabs expose `role=tablist/tab`, `aria-selected`, roving tabindex and the active panel's `aria-labelledby`; the dangling `aria-controls` references reported by review were removed rather than pointing at non-rendered panels.
- Dark tokens stay byte-identical; the light palette is a semantic override block with the same utility names. Capture checks assert exact dark and light colours and geometry; the capture theme seam is documented as verification-only.
- `terminal_theme` is local configuration with dark default; older app versions may warn/reject the new key, documented as a downgrade caveat. No OS-following mode.

## Independent review

Verdict: **OK with notes** (no blocker/major). Two MINOR ARIA findings were fixed:

1. `aria-describedby` always referenced the stored-token hint even when absent → now conditional.
2. Tabs referenced `panel-<id>` elements that are not rendered for inactive tabs → dangling `aria-controls` removed; the active panel keeps `aria-labelledby`.

Re-verification after fixes: lint, typecheck, 473 tests, build, settings smoke and dual-theme layout green.

## M25 update

AI Actions editing moved from Settings to a dedicated header-launched modal. Settings is resized; the AI Actions list now has footer counts and custom deletion confirmation, with bulk Reset removed. See `docs/41 - M25 verification audit.md`.

## Manual / residual

- Real browser opening, screen-reader navigation and measured light-theme ANSI/cursor/selection contrast were not independently verified; the design lists the WCAG targets and the light values are contrast-computed but an automated audit is still desirable.
- Deferred by design: OS-following theme, accent/ANSI customization, UI and terminal font size, line height, density, transparency, synced appearance.
- Settings smoke and captures depend on the test seams (`SMART_TERMINAL_HELP_FORCE_FAILURE`, `SMART_TERMINAL_THEME`); these are verification-only and not persisted.
