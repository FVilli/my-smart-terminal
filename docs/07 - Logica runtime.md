---
title: Logica runtime e stati
project: smart-terminal
type: architecture
version: 1
created: 2026-10-22
---
<!-- gsynchro:v1 id=a2a5d44f-2779-46ee-b847-04365a633dde registered=2026-10-23T07:57:47.694Z -->
# Logica runtime

## Avvio
1. Avvia finestra Electron senza single-instance lock globale.
2. Connetti al coordinatore locale via IPC; se assente, tenta elezione primary con lock OS e verifica del proprietario.
3. Primary apre clone dati, inizializza contatore per macchina, indice Markdown e GitSyncManager.
4. Ogni finestra crea i propri PTY, locale o `ssh <alias>` via OpenSSH.
5. UI si sottoscrive agli eventi sessione, history, clipboard, sync e primary.

## Sessione
Nuova tab -> richiedi ID atomico al coordinatore -> crea `sessions/<hostname>/YYYY-MM-DD_HH.mm_S<n>_<local|ssh-host>/` -> inizializza `session.md`, `history.md`, `clipboard.md` con frontmatter -> avvia PTY. Ogni sessione ha una bozza input separata. Cambio tab non termina il processo. Chiusura tab: conferma se attiva, termina PTY ordinatamente, aggiorna `session.md` e pianifica sync.

## Eventi e cattura
La scrittura Markdown è immediata e atomica (tmp + rename dove applicabile). History nativa acquisita tramite shell integration quando disponibile; prompt degli agenti tramite editor assistito o adapter verificati. Non interpretare sequenze di tasti TUI come prompt. Clipboard rilevata per istanza di servizio, deduplicata e filtrata; non catturare segreti riconosciuti e permetti pausa/cancellazione.

## Primary
Il ruolo primary è locale alla macchina: un solo coordinatore in scrittura per clone e contatore. Al crash: lock recuperabile, nuova elezione e rescan delle cartelle prima di assegnare ID. L'indicatore nella UI mostra primary/non-primary e non concede privilegi extra al renderer.

## Stati di sincronizzazione
`synced`, `dirty`, `syncing`, `offline`, `error`. Dirty dopo scrittura locale; debounce push 10 s e massimo 60 s con attività continua; fetch ogni 15 s. In caso di push respinto: fetch, rebase e retry limitato con backoff. Mai force-push; sui conflitti blocca il sync, preserva file e mostra errore. History remota visualizzabile dopo integrazione dei commit.
