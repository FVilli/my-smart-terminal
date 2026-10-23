---
title: Stack e struttura codice
type: architecture
project: smart-terminal
version: 1
created: 2026-10-22
---
<!-- gsynchro:v1 id=a1d8fd30-27d1-4418-ba70-e2a182bdd71a registered=2026-10-23T07:57:46.927Z -->
# Stack e struttura codice

## Stack vincolante
- Desktop: Electron, processi main/preload/renderer separati.
- UI: Angular standalone, TypeScript strict; tema CSS e componenti Angular.
- Terminale: `@xterm/xterm` + fit addon; PTY: `node-pty` in processo Node non privilegiato.
- Persistenza: solo file Markdown nel clone Git condiviso; no SQLite, no database, no storage remoto diverso dal Git scelto.
- Sincronizzazione: Git CLI (`fetch`, `commit`, `rebase`, `push`) serializzato dal servizio coordinatore per macchina.
- SSH: binario OpenSSH di sistema e parsing configurazioni Host/Include; non implementare protocollo SSH in JavaScript.
- AI: adapter Anthropic, OpenAI ed endpoint OpenAI-compatible; STT locale/cloud dietro adapter distinto.
- Segreti: keychain del sistema; mai nel repository dati.

## Monorepo
```text
apps/desktop/       # Electron main, preload, packaging
apps/renderer/      # Angular + xterm.js
packages/contracts/ # tipi ed eventi IPC condivisi
packages/terminal/  # PTY, session lifecycle, SSH
packages/data/      # Markdown read/write, ricerca in memoria
packages/sync/      # primary coordinator, Git, debounce
packages/ai/        # providers, correction, STT
```

## Contratti
Il renderer accede a filesystem, processi, Git e credenziali solo tramite API preload esplicite e tipizzate. `contextIsolation=true`, `nodeIntegration=false`; validare tutte le richieste IPC. Versioni esatte delle dipendenze sono fissate nel lockfile durante M01, senza aggiornamenti automatici da parte dei task successivi.

## Target
Desktop Linux, macOS, Windows; implementazione e test dei diversi PTY e pacchetti vanno effettuati nella relativa pipeline OS. Il terminale deve funzionare anche senza Git, AI o rete.

## Decisioni attuative
Monorepo npm workspaces, output `dist/apps/renderer/browser`, config Markdown locale, coordinatore su socket/named pipe, `safeStorage` e toolchain di test: `docs/10 - Config locale, coordinatore e sicurezza runtime.md`.
