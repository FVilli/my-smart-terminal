---
title: "M22 - T08 - Verify AI actions and close the milestone"
type: task
project: smart-terminal
created: 2026-10-25
id: "M22-T08"
milestone: "M22"
depends_on: "M22-T07"
deliverables: "Evidence-backed verification of all five actions, environment persistence, accessibility and non-regression, with an independent review"
---

# M22 - T08 - Verify AI actions and close the milestone

## Objective
Prove the milestone works end to end and did not regress terminal, IPC, sync, STT or the visual baseline.

## Implementation
- Run the full gates: lint, typecheck, unit tests, renderer build, documentation checks, layout at 1440×900 and 1024×700, zoom 50/100/200, screenshot harness, Linux packaging when available.
- Run every Electron smoke plus the new AI modal smoke; cover all five actions in test mode, the secret block, timeout/error/empty, `Use`/`Cancel`/`Close`, and a provider-unconfigured session.
- Verify environment persistence: local session writes OS/shell; SSH probe failure records `unknown`; values survive restart and the modal displays them; a session synced from another machine keeps its recorded environment.
- Verify accessibility and input contracts: focus trap/return, Escape, screen-reader names, no PTY interception, composer draft preservation, no automatic submission or execution.
- Manual checks that cannot be automated (real cloud provider, real SSH host, screen reader) are documented as manual with commands, or explicitly blocked with evidence.
- Independent review of the complete M22 diff against the M21 standards (docs/29–31) and the M20 visual baseline; record findings, fixes and residual debt.
- Record before/after evidence for changed file count, environment schema fields, new channels, prompt sizes and test counts.

## Acceptance
- All required gates green or explicitly blocked with evidence; no unapproved behaviour change.
- All five actions demonstrated; environment detection/persistence verified; no secret reaches the provider or any file.
- Independent review verdict recorded; residual debt listed.
- All M22 tasks in `done` before closing the milestone.
