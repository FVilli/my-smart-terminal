<!-- gsynchro:v1 id=8e92d508-e4e4-44bb-a3f4-16682ab1d0b2 registered=2026-10-23T09:58:42.363Z -->
<p align="center">
  <img src="apps/desktop/build/icon.png" width="96" alt="Smart Terminal" />
</p>

<h1 align="center">Smart Terminal</h1>

<p align="center"><strong>Il terminale che ricorda, collega e sincronizza il tuo lavoro.</strong></p>

<p align="center">
  Sessioni locali e SSH, history e clipboard in Markdown, sync Git multi-macchina,<br />
  correzione AI e dettatura vocale — tutto opzionale, tutto locale-first.
</p>

<p align="center">
  <img src="mockups/Smart%20Terminal%20-%20mock%20definitivo.png" alt="Interfaccia di Smart Terminal" width="880" />
</p>

---

## L'idea

Il terminale è il posto dove il lavoro tecnico succede davvero: comandi, debug, deploy, esperimenti. Ma la sua memoria evapora. Smart Terminal nasce per trasformare il terminale in una **base di conoscenza personale e condivisibile**, senza rinunciare alla velocità della shell.

- **Locale-first**: shell, PTY e sessioni funzionano senza rete, senza AI e senza Git.
- **Markdown + Git come memoria**: ogni sessione produce file leggibili e versionati, non un database proprietario.
- **Multi-macchina**: la stessa history e la stessa clipboard ti seguono tra i computer tramite il repository Git che scegli tu.
- **AI e voce quando servono**: correzione dei refusi e dettatura restano opzionali, non-invasive e mai automatiche.
- **Nessun lock-in**: i tuoi dati sono file, il tuo sync è Git, le tue chiavi restano nel keychain del sistema.

## Perché è diverso

| | Terminale classico | Smart Terminal |
| --- | --- | --- |
| Sessioni | tab volatili | tab persistenti, bozze e history per sessione |
| Memoria | scrollback locale | Markdown versionato e sincronizzato |
| Multi-macchina | copia/incolla manuale | repository Git condiviso, history globale |
| AI | copia/incolla in chat | correzione refusi contestuale, con review |
| Voce | app esterna | push-to-talk integrato, audio mai persistito |
| Dati | formati chiusi | file leggibili, nessun database |

## Funzionalità

- **Terminale reale**: PTY locale e SSH via OpenSSH, tab indipendenti, processi attivi anche in background.
- **SSH senza attriti**: alias letti da `~/.ssh/config` (inclusi `Include`), si usa l'agent di sistema, nessuna chiave copiata.
- **Input assistito**: editor multilinea, bozza separata per tab, `Invio` invia, `Shift+Invio` va a capo.
- **Correzione AI opzionale**: Anthropic, OpenAI o endpoint OpenAI-compatible; corregge solo refusi, preserva comandi/path/codice e richiede review.
- **Dettatura**: STT locale o cloud, push-to-talk, risultato editabile nella bozza; nessun audio salvato.
- **History e clipboard**: ricerca globale, filtro macchina, copia/reinserimento; clipboard opt-in con pausa e filtri segreti.
- **Sync Git**: debounce, fetch periodico, rebase/push senza force, conflitti che preservano i file, stato sempre visibile.
- **Multi-istanza**: coordinatore primary/secondary per macchina, lock recuperabile, ID sessione atomici.
- **Privacy by design**: token nel keychain, nessun segreto nei Markdown condivisi, AI/STT mai bloccanti.

## Download

> **v1.0.0 — release manuale, artefatti non firmati, nessun auto-update.**
> La pubblicazione su GitHub Releases è l'ultimo passaggio: gli artefatti sono pronti, ma non ancora pubblicati.

Quando la release sarà pubblicata, gli installer saranno qui:

**https://github.com/FVilli/my-smart-terminal/releases/latest**

| Piattaforma | Formato | Stato |
| --- | --- | --- |
| Ubuntu / Linux | AppImage, `.deb` | **pronto** (build locale in `release/`) |
| Windows | installer `.exe` | build CI prevista |
| macOS | `.dmg` | build CI prevista |

Nel frattempo, su Linux:

```bash
# AppImage (nessuna installazione)
chmod +x "release/Smart Terminal-1.0.0-linux-x86_64.AppImage"
"./release/Smart Terminal-1.0.0-linux-x86_64.AppImage"

# oppure pacchetto Debian
sudo dpkg -i "release/Smart Terminal-1.0.0-linux-amd64.deb"
```

Se FUSE non è disponibile: `--appimage-extract-and-run`. Verifica sempre il checksum SHA-256 in `release/SHA256SUMS`.

## Primo avvio

1. **Repository dati e macchina** — scegli dove tenere i Markdown e un nome macchina.
2. **Provider AI (opzionale)** — provider, modello e token nel keychain.
3. **Voce (opzionale)** — STT locale/cloud e verifica del microfono.

Puoi saltare AI e voce: il terminale resta completamente utilizzabile. La configurazione non segreta vive in `userData/config/config.md`; i token non finiscono mai nei Markdown.

## Dati e sincronizzazione

```text
sessions/
  <machine>/
    counter.md
    YYYY-MM-DD_HH.mm_S<n>_<local|ssh-alias>/
      session.md
      history.md
      clipboard.md
```

Il repository delle sessioni è separato dal repository del codice. Smart Terminal non usa database: la verità è nei file, la cronologia è Git. La history nativa della shell non viene intercettata: vengono registrati gli invii espliciti dall'editor assistito, mai keystroke o prompt TUI.

## Sicurezza e privacy

- Token AI/STT solo nel main process, cifrati con il keychain/`safeStorage`; su Linux con backend `basic_text` restano solo in memoria.
- Clipboard opt-in, con pausa, clear e filtri segreti best-effort.
- Nessuna registrazione audio persistente.
- AI e STT non eseguono mai comandi e non bloccano il terminale.
- Dettagli e rischi residui: [Security checklist](docs/13%20-%20Security%20checklist.md).

## Sviluppo

Requisiti: **Node.js 24**, Git, OpenSSH. Per gli smoke Linux serve Xvfb (il wrapper usa un display virtuale, mai il desktop).

```bash
npm ci
npm run dev          # Angular + Electron in sviluppo
npm run build
npm run test         # unit + integrazione (385 test)
npm run test:e2e     # due istanze Electron, failover e cross-machine
npm run lint
npx tsc -p tsconfig.json --noEmit
```

Packaging:

```bash
npm run package:linux   # AppImage + .deb
npm run package:mac     # .dmg (runner macOS)
npm run package:win     # installer NSIS (runner Windows)
npm run checksums       # release/SHA256SUMS
```

La CI GitHub Actions (`.github/workflows/ci.yml`) copre Linux/macOS/Windows; il workflow `release.yml` pubblica gli artefatti su tag `v*`.

## Architettura

```text
apps/desktop/       Electron main/preload e packaging
apps/renderer/      UI Angular standalone
packages/contracts/ contratti IPC tipizzati
packages/terminal/  PTY, SSH, session lifecycle
packages/data/      Markdown, allocazione ID, ricerca in memoria
packages/sync/      coordinatore primary/secondary, Git
packages/ai/        provider AI e STT
```

- Renderer isolato (`contextIsolation`, `sandbox`, `nodeIntegration: false`), API preload whitelisted.
- Coordinatore locale con lock OS, heartbeat e takeover; un solo scrittore Git per macchina.
- Indice di ricerca volatile, ricostruibile, senza database.

## Documentazione

- [Manuale utente](docs/12%20-%20Manuale%20utente.md)
- [Release notes](RELEASE_NOTES.md)
- [Workflow agenti](docs/WORKFLOW.md)
- [Build e rilascio](docs/09%20-%20Build%20e%20rilascio.md)
- [Contratti IPC](docs/11%20-%20Contratti%20IPC%20e%20verifica%20runtime.md)
- [Security checklist](docs/13%20-%20Security%20checklist.md)

## Stato e limiti noti

v1.0.0 è una release desktop completa e testata su Linux; macOS/Windows sono coperti dalla pipeline CI. Limiti dichiarati: shell history nativa non coperta, filtri segreti euristici, named pipe Windows senza ACL dedicate, firma degli artefatti non disponibile, nessun auto-update.

## Licenza

Licenza non specificata nel repository.
