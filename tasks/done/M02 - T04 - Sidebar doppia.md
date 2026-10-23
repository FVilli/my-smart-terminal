---
title: "M02 - T04 - Sidebar doppia"
type: task
project: smart-terminal
created: 2026-10-22
id: "M02-T04"
milestone: "M02"
depends_on: "T01"
deliverables: "Sidebar doppia"
---
<!-- gsynchro:v1 id=74577c89-ed0a-4873-b87e-6468e0c8f9f7 registered=2026-10-23T07:58:00.806Z -->

# M02 - T04 - Sidebar doppia

## Obiettivo
Sidebar doppia.

## Implementazione vincolata
Tab alternative Clipboard/History; ricerca e filtri; componente footer sync/primary.

## Criteri di accettazione
Cambio tabs e placeholder status corretti.

## Riferimenti
`docs/01 - Architettura.md`; `docs/02 - UI e sessioni.md`; `docs/03 - Markdown schema.md`; `docs/04 - Sync Git.md`; `docs/05 - AI Voice Sicurezza.md`.

## Non fare
Non introdurre database, servizi remoti aggiuntivi o scelte architetturali non specificate.

## Esito
- 2026-10-23: completato.
- Implementato: `sidebarTab` signal, cambio Clipboard/History con aria-selected, ricerca/filtro macchina abilitati (dati statici), placeholder distinti, footer con label dei quattro stati e indicatore primary, test layout esteso a overflow sidebar.
- Verifica: smoke sidebar con defaultClipboard, historySelected, clipboardSelected, placeholdersDiffer, controlsEnabled, syncLabel, primaryIndicator, noSidebarOverflow; layout 0.75 senza overflow a due viewport.
- Nota: dati reali della sidebar e stato sync/primary dinamico arrivano in M03/M04.
