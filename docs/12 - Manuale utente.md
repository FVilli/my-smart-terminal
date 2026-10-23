---
title: "Manuale utente"
type: manual
project: smart-terminal
created: 2026-10-23
---

# My Smart Terminal v1.0.0 — Manuale utente

## 1. Che cos’è

My Smart Terminal è un terminale desktop multi-istanza: ogni tab è una sessione PTY indipendente, locale oppure SSH. Offre input assistito, bozze per tab, history e clipboard consultabili, sessioni in Markdown e sincronizzazione Git. Un coordinatore locale assegna gli ID e serializza scritture e Git; una finestra può essere primary o secondary.

AI per la correzione dei refusi e riconoscimento vocale (STT) sono opzionali. Shell e PTY continuano a funzionare senza rete, AI o Git.

## 2. Installazione e requisiti

Scaricare l’artefatto per il proprio sistema:

- Linux: `.AppImage` oppure `.deb`;
- macOS: `.dmg`;
- Windows: installer `.exe` (NSIS).

Gli artefatti della V1 sono **non firmati** finché non saranno disponibili i certificati: il sistema operativo può quindi mostrare un avviso. Verificare sempre il checksum SHA-256 pubblicato insieme all’artefatto. La V1 non include auto-update: gli aggiornamenti sono manuali.

Per usare le funzioni di sviluppo servono Node.js 24, Git e OpenSSH. SSH usa il client di sistema e `~/.ssh/config`.

## 3. Primo avvio e onboarding

Al primo avvio il wizard propone tre passaggi:

1. **Repository dati e macchina** — scegliere il percorso del clone/repository dati e un nome macchina. Se si salta la configurazione, viene usato un repository locale predefinito; il terminale resta utilizzabile.
2. **Provider AI e token** — scegliere Anthropic, OpenAI o OpenAI-compatible, eventualmente base URL/modello, e salvare il token nel keychain del sistema. Su Linux, se il backend è `basic_text` o non è disponibile, il token viene tenuto solo in memoria per la sessione: non viene scritto in chiaro.
3. **STT e microfono** — scegliere STT locale o cloud, configurare il comando locale assoluto o il provider cloud, verificare il microfono e concedere il permesso. È possibile saltare questo passaggio.

La configurazione non segreta è in `userData/config/config.md` (su Linux tipicamente sotto `~/.config/...`, su macOS sotto `~/Library/Application Support/...`, su Windows sotto `%APPDATA%/...`). Non è sincronizzata. I token sono gestiti dal main tramite `safeStorage`/keychain e non sono inseriti nei Markdown; senza un keyring sicuro non c’è fallback plaintext.

La configurazione usa `schema_version: 1`. Se è illeggibile o sconosciuta, l’app conserva un backup `.bak` dell’ultima configurazione valida o mette quella corrotta in quarantena `.corrupt`, quindi riparte con default sicuri.

## 4. Uso quotidiano

### Tab e sessioni

- Premere `+` e scegliere **Local** oppure un alias SSH letto da `~/.ssh/config` (sono supportati anche `Include` e glob compatibili).
- Cambiare tab non termina il PTY: processo, output e bozza restano associati alla sessione.
- Chiudere una tab termina ordinatamente il PTY e aggiorna `session.md`; viene chiesta conferma quando necessario.
- Un errore SSH riguarda solo quella sessione e non blocca le altre.

### Input assistito

Ogni tab ha una bozza indipendente. **Invio** invia deliberatamente il testo al PTY; **Shift+Invio** inserisce una nuova riga. La bozza viene svuotata solo dopo un invio riuscito. Il terminale xterm resta utilizzabile direttamente: tasti e prompt di una TUI non vengono intercettati dall’editor.

**AI correction** si attiva con un clic esplicito e corregge solo probabili refusi nella bozza. Salta i testi riconosciuti come comandi shell e conserva codice, percorsi, URL, flag e significato. Rivedere sempre il risultato: non viene mai eseguito o inviato automaticamente.

### Microfono

Tenere premuto il controllo push-to-talk. Gli stati sono `Voice ready`, `Ascolto…`, `Trascrivo…` ed eventuale errore. La trascrizione entra nella bozza modificabile e non viene inviata automaticamente; cambiare tab o chiudere la finestra interrompe e scarta l’audio corrente.

### History e Clipboard

La sidebar alterna **History** e **Clipboard**.

- History: ricercare testo, filtrare per macchina, copiare oppure inserire nella bozza. La V1 registra gli invii espliciti dell’editor assistito; la shell history nativa non è registrata in modo generale.
- Clipboard: la raccolta è opt-in. Si può mettere in pausa, cancellare, cercare, copiare o inserire un elemento nella bozza. L’inserimento non invia mai automaticamente.

Il footer mostra lo stato Git (`synced`, `dirty`, `syncing`, `offline`, `error`) e il ruolo `primary`/`secondary`.

## 5. Dati e sincronizzazione

Nel repository dati l’app crea:

```text
sessions/<machine>/counter.md
sessions/<machine>/<data-ora>_S<n>_<local|ssh-alias>/
  session.md
  history.md
  clipboard.md
```

`S<n>` è progressivo per macchina e non viene riutilizzato. La scrittura Markdown è locale e immediata. La history è **assisted-only**: gli input digitati direttamente nella shell non vengono registrati, salvo un’integrazione shell affidabile già presente; non vengono intercettati keystroke o prompt TUI. Clipboard è opt-in, può essere sospesa o cancellata, e i filtri sono best-effort.

Il repository può essere un clone Git con remote e branch configurabili. Il coordinatore esegue fetch, commit, rebase e push in serie; di norma usa debounce di 10 s, attesa massima 60 s e fetch ogni 15 s. Senza remote compare **Repo non configurato**: i file restano locali. Offline produce commit locali e non blocca il terminale. In caso di push respinto viene tentato fetch/rebase/retry limitato; in caso di conflitto il sync si ferma in errore e preserva i file. Non viene mai usato force push.

## 6. Privacy e sicurezza

- Token AI/STT: solo keychain/`safeStorage`, mai nel repository o nel renderer.
- Non salvare password, chiavi private o altri segreti in Markdown.
- I filtri di history e clipboard riconoscono pattern comuni, ma sono euristici e non garantiscono di rilevare ogni segreto.
- Clipboard è disattivata finché non viene abilitata; l’audio STT resta in memoria, senza file persistenti.
- AI/STT hanno timeout e fallback: la loro indisponibilità non blocca PTY, shell, invio o scrittura locale.
- Il repository dati Git è considerato fidato: Git può eseguire hook/configurazioni del repository scelto. Non usare repository non fidati.

## 7. Risoluzione dei problemi

- **Repo non configurato**: impostare un remote/branch nella configurazione o continuare in locale; Git non è necessario per il PTY.
- **Push respinto o conflitto**: attendere il fetch/rebase automatico; se resta `error`, conservare i file locali, risolvere il conflitto con Git e riprovare senza force push.
- **SSH non raggiungibile**: verificare alias, rete, agent e `~/.ssh/config` con il comando `ssh <alias>`; l’app non copia chiavi private.
- **Microfono negato**: abilitare il permesso nelle impostazioni del sistema, riavviare se richiesto, oppure usare la tastiera.
- **AI/STT non disponibili**: controllare provider, token, endpoint e comando locale assoluto; il terminale resta operativo.
- **Secondary/primary**: `secondary` è normale con più finestre. Il takeover avviene solo se il primary non risponde più; non chiudere il primary funzionante per forzarlo.
- **Lock stale**: dopo un crash il nuovo primary recupera il lock quando il processo precedente non è più vivo; attendere il takeover, senza cancellare manualmente i file mentre l’app è attiva.
- **Keyring assente**: su Linux il token non viene persistito e può essere usato solo in memoria per la sessione; configurare un keyring sicuro per l’uso cloud persistente.
- **Log**: cercare l’output del processo Electron e i log dell’app nella directory dati utente; i log non devono contenere token, audio o testo AI. Gli errori mostrati all’interfaccia sono sanificati.
- **AppImage e FUSE**: se l’AppImage non si avvia, eseguire `./My-Smart-Terminal.AppImage --appimage-extract-and-run`.

## 8. Limiti V1 e compatibilità

La V1 non registra la shell history nativa in generale, non garantisce il riconoscimento di tutti i segreti, non aggiorna automaticamente e non firma gli artefatti. Le named pipe Windows usano autenticazione a token ma non ACL dedicate. AI/STT dipendono dal provider, dal keyring e dalla rete quando sono cloud.

I file di configurazione e Markdown usano `schema_version: 1`. Prima di aggiornare da una versione pre-1.0 fare una copia del repository dati e della configurazione. L’app crea backup `.bak` della configurazione valida e quarantena `.corrupt` quando rileva dati invalidi; non modifica distruttivamente i contenuti sincronizzati.

## 9. Sviluppo, test e packaging

Il repository è un monorepo npm workspaces:

```bash
npm ci
npm run dev
npm run build
npm run test
npm run test:e2e
```

Su Linux gli smoke Electron usano Xvfb, normalmente `:99`, tramite `scripts/run-electron.mjs`; non lanciare Electron sul desktop dell’utente. Per uno smoke esplicito, ad esempio:

```bash
npm run test:ipc-smoke
npm run test:pty-smoke
```

I comandi di packaging sono dedicati alla piattaforma:

```bash
npm run package:linux
npm run package:mac
npm run package:win
```

Usano electron-builder e producono rispettivamente AppImage/.deb, `.dmg` o installer NSIS. `npm run package` resta disponibile per il packaging generico. Dopo il packaging, eseguire `npm run checksums` e pubblicare i checksum SHA-256 insieme agli artefatti.

## 10. Riferimenti

- [Visione e scope](00%20-%20Visione.md)
- [Architettura](01%20-%20Architettura.md)
- [Interfaccia e sessioni](02%20-%20UI%20e%20sessioni.md)
- [Contratto Markdown](03%20-%20Markdown%20schema.md)
- [Sincronizzazione Git](04%20-%20Sync%20Git.md)
- [AI, voce e sicurezza](05%20-%20AI%20Voice%20Sicurezza.md)
- [Stack e struttura codice](06%20-%20Stack%20e%20struttura%20codice.md)
- [Logica runtime](07%20-%20Logica%20runtime.md)
- [UX e interazioni](08%20-%20UX%20e%20interazioni.md)
- [Build e rilascio](09%20-%20Build%20e%20rilascio.md)
- [Config locale, coordinatore e sicurezza runtime](10%20-%20Config%20locale,%20coordinatore%20e%20sicurezza%20runtime.md)
- [Contratti IPC e verifica runtime](11%20-%20Contratti%20IPC%20e%20verifica%20runtime.md)
- [Security checklist](13%20-%20Security%20checklist.md)
- [Workflow](WORKFLOW.md)
