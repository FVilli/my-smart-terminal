---
title: "M03 - T04 - Clipboard Markdown"
type: task
project: smart-terminal
created: 2026-10-22
id: "M03-T04"
milestone: "M03"
depends_on: "T01"
deliverables: "Clipboard Markdown"
---
<!-- gsynchro:v1 id=ccd348b8-2d57-4563-aaa9-b86b80cf1f44 registered=2026-10-23T07:58:03.865Z -->

# M03 - T04 - Clipboard Markdown

## Obiettivo
Clipboard Markdown.

## Implementazione vincolata
Monitorare clipboard testuale, deduplica, opt-out e secret filter, associare a sessione attiva.

## Criteri di accettazione
clipboard.md aggiornato senza duplicati e senza campioni sensibili.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: `ClipboardRecorder` testabile (opt-in, pausa, polling 800 ms, limite 32 KiB, hash, dedupe file+memoria, filtro segreti), servizio main con una sola istanza/timer, associazione sessione attiva su tab/focus, controlli sidebar (abilita, pausa, clear, stato), smoke con clipboard reale.
- Verifica: clipboard smoke con disabledByDefault, enabledViaUi, paused/resumedViaUi, eventRecorded, hashMatches, sensitiveNotRecorded, pollingContinuesAfterSensitive.
- Nota: "Cancella dedupe" azzera solo la memoria; gli hash già su file restano deduplicati.
