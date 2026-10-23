---
title: "Sincronizzazione Git"
type: spec
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=56a20afa-71a7-4266-a3d6-8bb7eb9ec0c1 registered=2026-10-23T07:57:45.482Z -->

# Sincronizzazione Git

## Ownership
Un clone locale del repository dati per macchina. Un solo GitSyncManager nel coordinatore possiede l'accesso Git, con mutex; tutte le finestre gli segnalano dirty events via IPC. Mai fare Git nel repository del progetto dell'utente.

## Default
Scrittura Markdown immediata; debounce push 10 s dall'ultima modifica, max wait 60 s; fetch ogni 15 s; sincronizzazione ad avvio, dopo recupero rete e a chiusura sessione. Parametri configurabili.

## Algoritmo
1. Schedula operazioni seriali. 2. Stage solo `sessions/` e metadati propri. 3. Commit se modifiche. 4. Fetch origin. 5. Rebase/integrate; se conflitto, preserva i file e segnala errore senza perdere contenuti. 6. Push; on non-fast-forward ripeti fetch/rebase/push con backoff limitato. 7. Aggiorna cache in memoria e notifica finestre.

## Semantica
Near-real-time, non realtime garantito. Nessun force push. Offline: file locali persistenti e coda implicita Git; non bloccare shell. Repo privato e sanitizzazione segreti prima della scrittura.
