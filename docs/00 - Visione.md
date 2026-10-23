---
title: "Visione e scope"
type: spec
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=9636ca63-18a7-4e49-af25-3d7c3266893c registered=2026-10-23T07:57:42.289Z -->

# Visione e scope

## Obiettivo
Terminale desktop multi-istanza per shell locali e SSH, con clipboard, dettatura, correzione refusi, history globale sincronizzata e riuso dei Markdown come contesto AI.

## In scope MVP
PTY reale, tab multi-sessione, menu host SSH, input assistito opzionale, clipboard/history alternative, sessioni in Markdown, GitHub sync, configurazione iniziale, provider AI/STT.

## Esclusioni MVP
Nessun database, nessun cloud proprietario, nessuna esecuzione automatica di comandi corretti dal modello, nessun intercettamento euristico dei prompt delle TUI.

## Regola
Shell e PTY devono funzionare senza rete, AI e GitHub.
