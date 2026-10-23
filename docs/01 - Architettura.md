---
title: "Architettura"
type: spec
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=c4141769-a174-4af4-a6e3-b252b33b60ef registered=2026-10-23T07:57:43.073Z -->

# Architettura

## Stack fissato
Angular standalone + TypeScript, Electron, `@xterm/xterm`, `node-pty`, servizi Node.js, OpenSSH CLI, Git CLI. Nessun SQLite o database.

## Processi
Ogni finestra Electron è indipendente; mantiene i propri PTY. Un coordinatore locale esclusivo per macchina gestisce contatori, scritture condivise e Git. Processo primary eletto con lock OS e heartbeat; le altre finestre usano IPC locale. Se primary termina, nuova elezione.

## IPC
`contextIsolation: true`, sandbox renderer e `nodeIntegration: false`; API preload tipizzate e whitelist per operazione. Nessuna esecuzione di stringhe shell da IPC; percorsi convalidati.

## Dati
La sorgente persistente è il filesystem Markdown nel clone Git. Indici di ricerca esclusivamente in memoria, ricostruibili. Config sensibile nel keychain OS, mai nei Markdown condivisi.

## Failure mode
PTY indipendenti dalla rete; coordinatore riavviabile; lock con recovery; operazioni Git serializzate e mai `push --force`.
