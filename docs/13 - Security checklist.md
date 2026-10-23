---
title: "Security checklist"
type: security
project: smart-terminal
version: 1
created: 2026-10-23
---
<!-- gsynchro:v1 id=7e113487-ddbb-4a25-80fb-dc9a7e4d2964 registered=2026-10-23T09:58:42.367Z -->

# Security checklist

Verifica eseguita su M06-T02. Ogni voce indica stato, implementazione e test/limite.

## Electron e renderer
- [x] `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; preload con API whitelisted. Test: smoke IPC verifica `require`/`process` undefined.
- [x] `setWindowOpenHandler` nega nuove finestre; `will-navigate` confronta l'**origin esatta** (dev server o `smart-terminal://bundle`). Test: `navigation.spec.ts`.
- [x] Protocollo `smart-terminal://` valida host, URI decodificabili, null byte, traversal e contenimento nel renderer root. Test: `navigation.spec.ts`.
- [x] CSP senza `unsafe-eval`; script solo self; nessun webview/`enableRemoteModule`.
- [x] Permission handler concede solo `media` audio; camera/video negati. Microfono richiesto esplicitamente dal wizard/STT.
- [x] Nessun `shell.openExternal`, `eval`, `new Function` o `exec` di stringhe.

## IPC
- [x] Sender: id finestra tracciata + main frame + origin; payload con chiavi esatte, tipi, range e limiti.
- [x] Limite globale 128 KiB; audio STT con limite per-canale 10 MiB + margine e conteggio binario reale.
- [x] Errori sanificati: codici stabili, niente stack/path/token al renderer.
- [x] Canali AI/STT: testo/audio validati anche nel main (difesa in profondità); token mai in risposta.
- [x] Test negativi: payload invalidi, canale sconosciuto, oversize, sender errato, subframe, origin estranea.

## File e path
- [x] Machine/destination normalizzate; path sessione con prefisso `sessions/<machine>/` e timestamp/ID validati.
- [x] `assertNoSymlinkComponents` rifiuta symlink in `sessions/`, machine o directory sessione (scritture history/clipboard e allocatore). Test dedicato.
- [x] Scritture atomiche (tmp + rename); directory dati/secrets `0700`, file segreti `0600`.
- [x] Search non segue symlink, salta file >2 MiB; lock/tmp non versionati.

## Segreti
- [x] Token AI/STT solo main, cifrati con `safeStorage`; backend Linux `basic_text`/sconosciuto o cifratura assente → solo memoria, warning, mai plaintext.
- [x] Renderer riceve solo stato/keys, mai il token; logout cancella file e memoria.
- [x] Config Markdown senza segreti; parser rifiuta campi sconosciuti, URL con credenziali/query, remote con password.
- [x] Log/build: nessun log di token, audio o testo AI; audit con `rg` e test.

## History, clipboard, AI, STT
- [x] History solo invii espliciti editor; nessun keystroke/TUI; filtro segreti best-effort; opt-out.
- [x] Clipboard opt-in, pausa/clear, hash + dedupe, limite 32 KiB, filtro segreti best-effort.
- [x] AI: solo click esplicito, shell detection, timeout/fallback, nessuna esecuzione automatica.
- [x] STT: push-to-talk, permessi, audio solo in memoria, nessun file temporaneo, comando locale assoluto senza shell.

## Coordinator e Git
- [x] Lock primary con mkdir atomico, nonce, heartbeat, stale recovery; il renderer non ottiene privilegi dal ruolo.
- [x] Socket Unix `0600` in dir `0700` o named pipe; token `0600` constant-time; protocollo JSON line max 1 MiB, metodi/params whitelisted.
- [x] Path socket oltre ~100 char → directory privata in temp per-utente (fallback testato).
- [x] Git via `execFile`, branch validato, remote rifiuta `-`, control/whitespace e password incorporate; stage solo `sessions/`; mai `--force`.
- [x] SSH: alias validato, file+args, nessuna chiave letta/copiata, agent ereditato.

## Rischi residui accettati
- Filtri segreti euristici: non garantiscono il riconoscimento di ogni segreto.
- Named pipe Windows non ha ACL dedicate: autenticazione a token, stesso utente; hardening ACL futuro.
- Git può eseguire hook/config del repo dati scelto dall'utente: il repo è fidato per definizione; non clonare repo non fidati.
- `safeStorage` dipende dal keyring OS; senza backend sicuro i token restano in memoria.
- Firma macOS/Windows non disponibile: artefatti dichiarati non firmati finché non ci sono certificati.
- Nessun auto-update in V1; aggiornamento manuale.

## Comandi di verifica
`npm run test`, `npm run test:coordinator`, `npm run test:e2e`, `npm run test:ipc-smoke`, `npm run test:stt-smoke`, `npm run test:ai-smoke`, `npm run lint`, `npx tsc -p tsconfig.json --noEmit`.
