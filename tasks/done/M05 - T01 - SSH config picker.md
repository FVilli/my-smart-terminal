---
title: "M05 - T01 - SSH config picker"
type: task
project: smart-terminal
created: 2026-10-22
id: "M05-T01"
milestone: "M05"
depends_on: ""
deliverables: "SSH config picker"
---
<!-- gsynchro:v1 id=5543bedc-432a-4002-9117-9e5785645c2c registered=2026-10-23T07:58:08.186Z -->

# M05 - T01 - SSH config picker

## Objective
SSH config picker.

## Constrained implementation
Read aliases from ~/.ssh/config, including Include directives, and open the OpenSSH client in the PTY.

## Acceptance criteria
Selection from + opens an SSH tab and uses the SSH agent; no key is copied.

## References
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Do not
Do not introduce databases, additional remote services, or architectural choices not specified.

## Outcome
- 2026-10-23: completed.
- Implemented: SSH parser with multiple Host entries/Include/glob/quoting and limits, alias list, `ssh <alias>` command with file+args, validated alias, and inherited agent environment; extended contracts/kind/target, `+` menu with aliases, tab and session.md with ssh_alias, and isolated SSH errors.
- Verification: SSH smoke with config+Include+wildcard, fake ssh (alias and SSH_AUTH_SOCK only), decoy key not copied, failed session with no impact on others; 319 tests.
