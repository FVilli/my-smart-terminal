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

## Obiettivo
SSH config picker.

## Implementazione vincolata
Leggere alias ~/.ssh/config inclusi Include e aprire client OpenSSH nel PTY.

## Criteri di accettazione
Scelta da + apre tab SSH e usa SSH agent; nessuna chiave copiata. 

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: parser SSH con Host multipli/Include/glob/quoting e limiti, lista alias, comando `ssh <alias>` file+args con alias validato e ambiente agent ereditato; contratti/kind/target estesi, menu `+` con alias, tab e session.md con ssh_alias, errori SSH isolati.
- Verifica: smoke SSH con config+Include+wildcard, fake ssh (solo alias e SSH_AUTH_SOCK), chiave decoy non copiata, sessione fallita senza impatto sulle altre; 319 test.
