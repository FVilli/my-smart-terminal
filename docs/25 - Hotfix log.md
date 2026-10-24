---
title: "Hotfix log"
type: reference
project: smart-terminal
created: 2026-10-23
---
<!-- gsynchro:v1 id=c546f656-ad9c-44c7-b42a-5faa9ce9a4c3 registered=2026-10-23T20:20:48.253Z -->

# Hotfix log

## Process for urgent fixes

Small, user-visible fixes do not need a milestone. Use this lightweight path:

1. Open a GitHub issue labelled **bug** and **hotfix**, with reproduction steps and affected version.
2. Create a short `hotfix/<slug>` branch (or commit directly to `main` only for a trivial, already-verified fix).
3. Add a focused regression test and run the normal lint/test/build gate.
4. Add an entry to this log with an immutable `HF-YYYYMMDD-NN` ID, commit, tests and release version.
5. Update `CHANGELOG.md` and `RELEASE_NOTES.md`, then publish a **patch** release (`vX.Y.Z+1`). Do not label a hotfix as a feature release.
6. Close the issue with the release link and verification evidence.

Milestones remain for planned work; hotfixes are tracked by issue + this log + patch release so they do not distort milestone planning.

## Entries

The entries below are historical release records. Their versions describe the affected releases and are not the current application version; current documentation describes v1.3.0.

| ID | Version | Symptom | Fix | Evidence |
| --- | --- | --- | --- | --- |
| HF-20261023-01 | 1.2.1 | Window title showed only `Smart Terminal`; version was not visible. | Prevented `page-title-updated` from replacing the versioned title and reasserted it after load. | `versionedWindowTitle` in settings smoke. |
| HF-20261023-02 | 1.2.1 | Header gear appeared to do nothing while settings state was loading. | Settings dialog opens immediately in edit mode before awaiting IPC, then populates state; closes on IPC failure. | Settings smoke `opened`/tabs; manual packaged-app check. |
| HF-20261023-03 | 1.2.2 | Terminal text selection could not be copied. | Added Ctrl+Shift+C, Cmd+C and Ctrl+Insert copy through the main-process clipboard, preserving terminal SIGINT behavior. | terminal-copy unit tests; editor/PTY smokes. |
| HF-20261023-04 | 1.2.2 | Settings gear worked only the first time. | Reset SettingsStore on every close path (save, warnings, restart notice) and added second-open regression assertion. | settings-smoke `reopenedAfterSave`. |
| HF-20261024-01 | 1.3.1 | Composer had a contrasting strip outside its border, non-monospace draft text, emoji-like controls and “STT not configured” text; mic state was unclear. | Matched outer/inner backgrounds, explicit mono font, SVG controls, removed unconfigured label, configured/active mic colors. | editor/settings/layout smokes. |
| HF-20261024-02 | 1.3.1 | Ubuntu/menu icon still showed an opaque square. | Replaced packaging icon with the transparent RGBA asset and rebuilt the Linux package. | RGBA corner/alpha check; package verification. |
| HF-20261024-03 | 1.3.1 | Right panel used separate header buttons and no active/inactive toggle variant. | Single accessible toggle with distinct active/inactive SVG variants and remembered History/Clipboard section. | settings-smoke panel toggle checks. |
| HF-20261024-04 | 1.3.2 | Composer outer area used the same color as the field interior. | Set composer host background to terminal/app background; interior keeps input background; updated layout metric. | layout/editor/settings smokes. |
