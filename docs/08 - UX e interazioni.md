---
title: UX e interazioni
project: smart-terminal
type: design
version: 1
created: 2026-10-22
---
<!-- gsynchro:v1 id=48cb6ca1-9a73-4164-b528-4204e5c909ba registered=2026-10-23T07:57:48.553Z -->
# UX e interazioni

## Riferimento
Mock approvato: `mockups/Smart Terminal - mock definitivo.png`. Non modificarne la gerarchia senza decisione esplicita: header; tab sessioni; area output; input assistito in basso; barra destra history/clipboard.

## Layout
Terminale 75%, sidebar 25%, entrambe le colonne `min-width:0`; su finestre strette gestire overflow dei contenuti, senza modificare il rapporto di default. Tema scuro. Output xterm e editor di input **monospace** (`JetBrains Mono`, `Cascadia Code`, `monospace`); UI esterna può usare sans-serif.

## Tab e SSH
Ogni tab rappresenta un PTY distinto e mostra `S<n>` e destinazione; `+` apre menu con Local e alias SSH letti da `~/.ssh/config`. Cambiare tab conserva processo, viewport e bozza. Chiudere tab non tocca altre sessioni.

## Input e sidebar
Input assistito sempre visibile in basso, AI correction a sinistra, mic + `Voice ready` in basso a destra. Premere invio effettua un invio deliberato (definire shortcut esplicita per newline). Correzione solo di prompt in linguaggio naturale, non di comandi shell. Sidebar mostra alternativamente History globale (ricerca e filtro macchina) o Clipboard (copia/reinserimento). Il footer mostra GitHub sync e icona primary accesa/spenta.

## Stati vuoti/errori
History senza risultati, repo non configurato, SSH non raggiungibile, microfono negato, AI non disponibile, primary assente e sync offline devono mostrare messaggio localizzato, senza bloccare l'uso del terminale.
