---
title: "M06 - T02 - Security hardening"
type: task
project: smart-terminal
created: 2026-10-22
id: "M06-T02"
milestone: "M06"
depends_on: "T01"
deliverables: "Security hardening"
---
<!-- gsynchro:v1 id=505f3660-7dd4-4284-a672-caec66549277 registered=2026-10-23T07:58:11.585Z -->

# M06 - T02 - Security hardening

## Obiettivo
Security hardening.

## Implementazione vincolata
Audit IPC, path traversal, secret filtering, keychain e logs.

## Criteri di accettazione
Test negativi e report checklist senza segreti nei file.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: origin esatta per navigazione, protocol handler anti-traversal/null/URI invalidi, rifiuto symlink nei path sessione e allocatore, fallback socket path lungo, validazione remote Git, limiti payload per-canale, audit log/API rischiose.
- Verifica: 385 test (navigation hardening, path safety, endpoint lungo, remote Git, IPC negativi); lint/typecheck/build verdi.
- Report: `docs/13 - Security checklist.md` con rischi residui (filtri euristici, ACL named pipe, hook Git, keyring, firma, no auto-update).
