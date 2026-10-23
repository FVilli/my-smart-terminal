---
title: "Config locale, coordinatore e sicurezza runtime"
type: adr
project: smart-terminal
version: 1
created: 2026-10-23
---
<!-- gsynchro:v1 id=37a01d97-fc66-464e-8edf-bbf5a5e3ae23 registered=2026-10-23T08:09:36.838Z -->

# ADR - Config locale, coordinatore e sicurezza runtime

## Stato
Accettato per M01-M06. Le decisioni integrano `docs/01`, `docs/03`, `docs/04`, `docs/06` e `docs/07` senza cambiare lo stack.

## Contesto
Servono: configurazione iniziale prima che esista un clone dati, più finestre Electron indipendenti sulla stessa macchina, un solo scrittore Git, credenziali fuori dai Markdown condivisi. Le specifiche non fissano il trasporto IPC locale, il formato della config né il meccanismo keychain.

## Decisioni

### D1 - Configurazione non segreta locale
- La config non segreta è Markdown locale in `app.getPath('userData')/config/config.md`; **non** è sincronizzata e **non** vive nel clone dati.
- Il clone dati contiene solo `sessions/`; il suo percorso è a sua volta config per-macchina. Prima dell'onboarding il default è `userData/data`, creato localmente con `sessions/`: shell e PTY funzionano senza rete/AI/Git. Override di test: `SMART_TERMINAL_DATA_REPO`.
- Il contatore `S<n>` vive in `sessions/<machine>/counter.md` (metadata versionato), protetto dal lock del primary; dettagli in `docs/03`.
- Schema (`schema_version: 1`, frontmatter flat): `machine_name`, `data_repo_path`, `data_repo_remote?`, `ai_provider` (`none|anthropic|openai|openai-compatible`), `ai_base_url?`, `ai_model?`, `stt_provider` (`none|local|cloud`), `stt_model?`, `sync_debounce_ms?`, `sync_max_wait_ms?`, `sync_fetch_interval_ms?`, `clipboard_enabled?`. Nessun token, chiave o password.
- Percorso: `userData/config/config.md` (override `SMART_TERMINAL_CONFIG_PATH`); backup `.bak` dell'ultima versione valida, quarantena `.corrupt`, ripristino solo se il backup è valido. Precedenza env > config > default (repo, machine, remote, tempi, clipboard) senza mutare `process.env`.
- Scrittura atomica (file temporaneo nella stessa directory + rename) e parser validante con default sicuri. File illeggibile o schema ignoto: backup del file e ripristino dei default, senza bloccare il terminale.
- La machine identity è `machine_name` normalizzata (niente slash); non deriva da hostname di rete e non viene condivisa.

### D2 - Coordinatore primary locale
- Ogni finestra Electron avvia il proprio main; **nessun** single-instance lock globale.
- Elezione: directory lock `userData/coordinator/lock/` creata atomicamente (`mkdir`) contenente `owner.json` con `pid`, `nonce`, `created_at`, `heartbeat_at`. Il lock non impedisce l'avvio di altre finestre.
- Trasporto: Unix domain socket `userData/coordinator/coordinator.sock` con directory `0700` e socket `0600`; su Windows named pipe `\\.\pipe\smart-terminal-<hash(userData)>`, autenticazione a nonce. Protocollo JSON-RPC con metodi whitelisted, payload massimo 1 MiB, validazione dei parametri.
- Heartbeat ogni 3 s; takeover consentito solo se il lock è stale (heartbeat oltre 10 s) e il PID non è più vivo, o se l'endpoint non risponde; l'acquisizione finale usa di nuovo `mkdir` atomico. I secondari restano client finché l'endpoint risponde.
- Protocollo JSON line-delimited (max 1 MiB) con token in `userData/coordinator/token` (`0600`, confronto constant-time) e metodi whitelisted; il client rilegge il token a ogni richiesta, così dopo un takeover raggiunge il nuovo primary.
- Se il primary non è raggiungibile, l'allocazione secondaria ripiega sull'allocatore su file con lock condiviso (stesso `primary.lock`/lock allocatore): nessun blocco fino al takeover e nessun ID duplicato. Il ruolo resta `secondary` finché il takeover non riesce.
- Limite noto: il path Unix socket ha un massimo di ~108 caratteri; userData molto profondi richiedono un path più corto (hardening M06).
- Il coordinatore è l'unico proprietario di contatori macchina, scritture condivise, indice e Git. Il renderer non riceve privilegi dal ruolo primary.
- L'allocazione `S<n>` è incapsulata dietro un servizio: M03 usa il lock locale, M04 la espone dal primary via IPC locale senza creare un secondo lock incompatibile.

### D3 - Credenziali e keychain
- I token AI/STT sono gestiti solo nel processo main con Electron `safeStorage`, mai nel renderer e mai in chiaro. File cifrati `userData/secrets/<provider>.json` con permessi `0600` e scrittura atomica; il renderer vede solo l'elenco delle chiavi presenti.
- Su Linux si considera il backend effettivo: se è `basic_text` o la cifratura non è disponibile, il token non viene persistito; è ammessa solo una credenziale in memoria per la sessione, con indicazione esplicita nella UI. Nessun fallback plaintext.
- Logout/revoca eliminano il token dal keychain e dalla memoria.

### D4 - Toolchain e test
- npm workspaces con la struttura di `docs/06`; versioni esatte nel lockfile. Tooling di sviluppo: `esbuild` per bundle main/preload, `concurrently`/`wait-on`/`cross-env` per il dev workflow, `electron-builder` per i pacchetti. Non sono runtime aggiuntivi.
- Angular application builder con output `dist/apps/renderer/browser`; Electron carica `file://` in produzione e l'URL del dev server in sviluppo.
- Vitest per package e integration test; adapter PTY iniettabile e mock nei test unitari. Test coordinatore/Git con processi child, directory temporanee e repository bare locali, senza display. Smoke Electron con `xvfb-run` in CI Linux.

## Conseguenze
- La config locale non è condivisa tra macchine: nome macchina e path restano corretti per ogni installazione.
- Un crash del primary è recuperabile senza perdere sessioni; i PTY delle finestre restano attivi.
- Se manca un keyring adeguato, AI/STT cloud restano disabilitati ma terminale, Markdown e Git continuano a funzionare.
- I test di portabilità richiedono la pipeline OS corrispondente per `node-pty` e packaging.

## Riferimenti
`docs/01 - Architettura.md`, `docs/03 - Markdown schema.md`, `docs/04 - Sync Git.md`, `docs/05 - AI Voice Sicurezza.md`, `docs/06 - Stack e struttura codice.md`, `docs/07 - Logica runtime.md`.
