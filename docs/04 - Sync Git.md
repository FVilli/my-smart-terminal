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

## Implementazione (M04)
- `GitEngine` usa `execFile('git')` con `GIT_TERMINAL_PROMPT=0`, senza shell e senza `--force`; le operazioni mutanti sono serializzate da un mutex.
- Init: `git init -b <branch>` se assente, identità locale, `.gitignore` per temporanei; remote opzionale da `SMART_TERMINAL_GIT_REMOTE`, branch da `SMART_TERMINAL_GIT_BRANCH` (default `main`).
- Stage/commit solo `sessions/`: `git add -- sessions`, `git commit -- sessions`, nessun commit a vuoto.
- Fetch → rebase su `origin/<branch>`; conflitto: `rebase --abort`, file preservati, stato `error`. Push `HEAD:<branch>` con retry/backoff limitato su non-fast-forward.
- Senza remote configurato: commit locali, nessun push; la UI deve mostrare "repo non configurato" e non bloccare il terminale.
- Scheduler: debounce 10 s dall'ultimo dirty, max wait 60 s dall'attività continua, fetch ogni 15 s; un solo sync/fetch alla volta con coalescing. Il fetch periodico usa `integrateRemote()`: se il working tree tracked è pulito e il branch è indietro, rebase su `origin/<branch>` e aggiornamento dell'indice; nessun commit/push dal fetch. Con modifiche tracked non committate l'integrazione è rinviata a `syncOnce`. Parametri: `SMART_TERMINAL_SYNC_DEBOUNCE_MS`, `SMART_TERMINAL_SYNC_MAX_WAIT_MS`, `SMART_TERMINAL_SYNC_FETCH_INTERVAL_MS`. A stop/chiusura il manager tenta un flush con timeout di 5 s.
