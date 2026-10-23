# Release notes

## v1.0.0

Prima release utente di My Smart Terminal. Data di rilascio: non specificata.

### Funzionalità

La release completa i moduli M01–M06:

- terminale desktop Electron multi-istanza con tab PTY locali e SSH;
- sessioni e metadati persistiti in Markdown, contatore per macchina e ricerca;
- history degli invii assistiti e clipboard opt-in, con pausa, clear e filtri;
- coordinatore locale primary/secondary, lock con heartbeat, takeover e allocazione sicura degli ID;
- sincronizzazione Git serializzata, fetch/rebase/push senza force push, stati offline/error e preservazione dei conflitti;
- onboarding per repository dati, nome macchina, provider AI e STT;
- correzione AI opzionale per soli refusi, con review prima dell’invio;
- STT locale/cloud push-to-talk, audio solo in memoria e microfono non bloccante;
- hardening Electron/IPC, validazione dei path, protezione dei segreti e test runtime.

### Installazione e piattaforme

Sono previsti questi artefatti electron-builder:

- Linux: AppImage e `.deb`;
- macOS: `.dmg`;
- Windows: installer `.exe`.

Verificare il checksum SHA-256 pubblicato con ciascun artefatto. Gli artefatti sono **non firmati** finché non sono disponibili certificati macOS/Windows (e non va presunta alcuna firma). Non è incluso auto-update in V1: l’aggiornamento è manuale.

### Limiti noti

- La shell history nativa non è coperta in generale: vengono registrati gli invii espliciti dell’editor assistito, non keystroke o prompt TUI.
- I filtri di history/clipboard sono best-effort ed euristici: non riconoscono necessariamente ogni segreto.
- Le named pipe Windows usano autenticazione a token ma non ACL dedicate.
- `safeStorage` dipende dal keyring del sistema; su Linux con backend `basic_text` o senza cifratura i token restano solo in memoria.
- Git può eseguire hook e configurazioni del repository dati: scegliere un repository fidato e non clonare repository non fidati per usarli come repository dati.
- AI/STT cloud dipendono da rete, provider, permessi microfono e disponibilità del keyring; non sono necessari per il terminale.
- Non sono disponibili auto-update né firma degli artefatti in questa release.

### Migrazione da versioni pre-1.0

Prima dell’aggiornamento eseguire un backup del repository dati e della configurazione locale. La V1 usa `schema_version: 1` per configurazione e Markdown. La configurazione si trova in `userData/config/config.md` e non viene sincronizzata; token e segreti restano fuori dai Markdown.

Quando rileva una configurazione invalida, l’app conserva un backup `.bak` dell’ultima versione valida oppure mette il file in `.corrupt`, quindi applica default sicuri. I contenuti Markdown sincronizzati non vengono modificati distruttivamente: verificare il backup e risolvere manualmente eventuali conflitti Git.
