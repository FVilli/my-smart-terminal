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

| ID | Version | Symptom | Fix | Evidence |
| --- | --- | --- | --- | --- |
| HF-20261023-01 | 1.2.1 | Window title showed only `Smart Terminal`; version was not visible. | Prevented `page-title-updated` from replacing the versioned title and reasserted it after load. | `versionedWindowTitle` in settings smoke. |
| HF-20261023-02 | 1.2.1 | Header gear appeared to do nothing while settings state was loading. | Settings dialog opens immediately in edit mode before awaiting IPC, then populates state; closes on IPC failure. | Settings smoke `opened`/tabs; manual packaged-app check. |
