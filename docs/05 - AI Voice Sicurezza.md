---
title: "AI, voce e sicurezza"
type: spec
project: smart-terminal
created: 2026-10-22
---
<!-- gsynchro:v1 id=8517ddcb-12aa-4e8a-aac4-22d53c6b7a18 registered=2026-10-23T07:57:46.061Z -->

# AI, voce e sicurezza

## AI correction
Provider Anthropic, OpenAI e OpenAI-compatible locale tramite interfaccia comune. Correggere solo refusi nei prompt dell'editor assistito; preservare codice, path, comandi, flag e significato. Timeout e fallback all'originale. Mai alterare o eseguire automaticamente i comandi di shell. Conservare originali solo se policy di privacy lo consente.

## Implementazione AI correction (M05)
- Adapter Anthropic, OpenAI e OpenAI-compatible nel package `ai`, chiamati solo dal main; token da `safeStorage`/keychain e mai nel renderer.
- Prompt vincolato: correggere solo refusi, preservare codice/path/URL/comandi/flag/significato, restituire solo il testo. `temperature: 0`, timeout 8 s, fallback all'originale su errore/timeout/risposta vuota.
- I testi che sembrano comandi shell vengono saltati; la correzione è solo su click esplicito, aggiorna la bozza editabile e richiede review prima dell'invio. Nessuna esecuzione automatica.
- Errori AI non bloccano terminale o invio. Test seam `SMART_TERMINAL_AI_TEST_MODE=1` solo per smoke, mai in produzione.

## Voice
STT locale oppure cloud configurabile; microfono push-to-talk, permessi espliciti, bozza modificabile prima dell'invio. Nessuna registrazione permanente audio per default.

## Segreti
Token nel keychain OS, SSH via client OpenSSH/agent e `~/.ssh/config`; non salvare chiavi, password o contenuti sensibili in history/clipboard/repo. Filtri configurabili e modalità pausa raccolta; logout/revoca provider.

## Clipboard
- Raccolta opt-in esplicita, con pausa e cancellazione; una sola istanza di polling per macchina (main del primary in M04).
- Polling ~800 ms, deduplica SHA-256 in memoria, limite 32 KiB, scarto di contenuti vuoti/oversize.
- Filtro best-effort per chiavi private, token, password e URL con credenziali: non garantisce di riconoscere ogni segreto.
- Associazione alla sessione attiva aggiornata su cambio tab e focus finestra.

## Errori
AI/STT indisponibili non interrompono terminale e scrittura locale.
