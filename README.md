<!-- gsynchro:v1 id=8e92d508-e4e4-44bb-a3f4-16682ab1d0b2 registered=2026-10-23T09:58:42.363Z -->
# My Smart Terminal

Terminale desktop multi-istanza per sessioni locali e SSH, con tab indipendenti, input assistito, sessioni Markdown e sincronizzazione Git.

## Stato

**v1.0.0** — release manuale, con artefatti non firmati e senza auto-update.

## Funzionalità

- PTY locale e SSH tramite alias di `~/.ssh/config`;
- bozze per tab, invio con `Invio` e nuova riga con `Shift+Invio`;
- history assisted-only e clipboard opt-in con ricerca e filtro macchina;
- Markdown + Git, coordinatore primary/secondary e recupero del lock;
- correzione AI opzionale (Anthropic, OpenAI, OpenAI-compatible);
- STT locale o cloud opzionale, push-to-talk.

Shell e PTY funzionano senza rete, AI o Git.

## Requisiti

Node.js 24, Git e OpenSSH. Per eseguire l’app in sviluppo serve un ambiente grafico; gli smoke Linux usano Xvfb.

## Avvio rapido sviluppo

```bash
npm ci
npm run dev
```

## Build, packaging e test

```bash
npm run build
npm run test
npm run test:e2e
npm run package:linux   # oppure package:mac / package:win
npm run checksums
```

I comandi `package:linux`, `package:mac` e `package:win` usano electron-builder per i target AppImage/.deb, `.dmg` e installer `.exe`. Gli artefatti v1.0.0 non sono firmati; pubblicare i checksum SHA-256 generati da `npm run checksums`.

## Struttura

```text
apps/desktop/       Electron main/preload e packaging
apps/renderer/      UI Angular
packages/contracts/ contratti IPC
packages/terminal/  PTY e sessioni
packages/data/      Markdown e ricerca
packages/sync/      coordinatore e Git
packages/ai/        AI e STT
docs/               specifiche e guide
scripts/            build, smoke test e packaging
```

## Documentazione

- [Manuale utente](docs/12%20-%20Manuale%20utente.md)
- [Workflow](docs/WORKFLOW.md)
- [Build e rilascio](docs/09%20-%20Build%20e%20rilascio.md)
- [Security checklist](docs/13%20-%20Security%20checklist.md)

## Sicurezza e limiti

I token sono gestiti dal keychain/`safeStorage` e non vengono salvati nei Markdown. I filtri dei segreti sono euristici; clipboard è opt-in e l’audio STT non viene persistito. La shell history nativa non è coperta in generale. Le named pipe Windows non hanno ACL dedicate e Git può eseguire hook del repository dati scelto: usare repository fidati.

## Licenza

Licenza non specificata nel repository.
