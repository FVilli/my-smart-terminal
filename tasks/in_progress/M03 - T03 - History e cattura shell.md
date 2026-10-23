---
title: "M03 - T03 - History e cattura shell"
type: task
project: smart-terminal
created: 2026-10-22
id: "M03-T03"
milestone: "M03"
depends_on: "T01"
deliverables: "History e cattura shell"
---
<!-- gsynchro:v1 id=b214312f-aed5-4799-8c99-a530cd628df7 registered=2026-10-23T07:58:03.113Z -->

# M03 - T03 - History e cattura shell

## Obiettivo
History e cattura shell.

## Implementazione vincolata
Acquisire invii editor e shell con meccanismo affidabile; eventi idempotenti.

## Criteri di accettazione
history.md aggiornato; password non salvate; nessun logging raw keystroke.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: filtro segreti condiviso, `history:record` con source fisso `assisted`, UUID/timestamp/cwd, idempotenza e atomicità, chiamata renderer solo dopo invio riuscito, smoke editor esteso.
- Verifica: test filtro/append/limiti; editor smoke con historyAssistedRecorded, historyEnterRecorded, historySensitiveNotRecorded, historyCwdPresent.
- **Deviazione esplicita**: la shell nativa non è registrata in M03. Nessuna iniezione in `.bashrc`/`.zshrc`, nessun keystroke, nessuna intercettazione TUI; solo invii espliciti dall'editor assistito (`docs/03`).
