---
title: "Interfaccia e sessioni"
type: spec
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=0c18662a-8789-43bb-89e5-08f13400756c registered=2026-10-23T07:57:43.848Z -->

# Interfaccia e sessioni

## Baseline visiva
Riferimento immutabile: `mockups/Smart Terminal - mock definitivo.png` (immagine fornita dall'utente). Layout 75% terminale / 25% sidebar, tema scuro, terminale e input in font monospace.

## Comportamento
Tab superiori per sessioni locali e SSH; `+` apre scelta Local/alias da `~/.ssh/config`. PTY attivi anche se tab non in focus. Sidebar con tabs alternative Clipboard/History, ricerca e filtro macchina. History include tutte le macchine sincronizzate.

## Input assistito
Editor ancorato in basso, bozza per sessione, AI correction a sinistra, microfono e `Voice ready` in basso a destra. Invio volontario al PTY; terminale nativo resta sempre usabile.

## Stato footer
`GitHub synced` (con stati syncing/offline/error) e icona `Primary instance` accesa solo per il leader locale; read-only indicativo, aggiornata via IPC.
