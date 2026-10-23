---
title: "Contratti IPC e verifica runtime"
type: contract
project: smart-terminal
version: 1
created: 2026-10-23
---
<!-- gsynchro:v1 id=65893937-7b8b-4a2a-8d10-a731a2aad10b registered=2026-10-23T08:19:15.144Z -->

# Contratti IPC e verifica runtime

Documento operativo: elenca i confini main/preload/renderer e i comandi di verifica. Le fonti normative restano `docs/01`, `docs/06` e `docs/10`.

## Regole
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; il renderer non vede `require`/`process`.
- Il preload espone solo metodi tipizzati; nessun `invoke` generico in produzione.
- Ogni canale è whitelisted in `packages/contracts/src/index.ts`, validato nel main (payload, dimensione, sender main-frame e origin) e risponde con errori a codice, senza path o stack.
- Limite payload JSON 128 KiB; limiti specifici per campo (es. write PTY 64 KiB, dimensioni 1-1000).
- Eventi main→renderer separati dai canali invocabili e con unsubscribe.

## Canali invocabili (stato M01)
| Canale | Payload | Risposta |
| --- | --- | --- |
| `app:ping` | nessuno | `{ appVersion, platform }` |
| `app:runtime-info` | nessuno | `{ appVersion, platform, isPackaged }` |
| `terminal:create` | `{ kind:'local', cwd?, cols?, rows? }` | `TerminalSessionInfo` |
| `terminal:write` | `{ sessionId, data }` | `void` |
| `terminal:resize` | `{ sessionId, cols, rows }` | `void` |
| `terminal:close` | `{ sessionId }` | `void` |
| `terminal:list` | nessuno | `TerminalSessionInfo[]` |
| `history:record` (T03) | `{ sessionId, text, agent? }` | `{ recorded: boolean }` |
| `clipboard:configure` (T04) | `{ enabled?, paused? }` | stato clipboard |
| `clipboard:set-active` (T04) | `{ sessionId }` | `void` |
| `clipboard:clear` (T04) | nessuno | `void` |
| `search:query` (T05) | `{ query, machine?, sessionId?, from?, to? }` | risultati (cap 100) |

Eventi: `terminal:data` (`{ sessionId, data }`), `terminal:exit` (`{ sessionId, exitCode, signal? }`). Ogni finestra ha il proprio `SessionManager`; alla chiusura/distruzione i PTY vengono terminati.

## API preload
`ping`, `runtimeInfo`, `createTerminal`, `writeTerminal`, `resizeTerminal`, `closeTerminal`, `listTerminals`, `onTerminalData`, `onTerminalExit`, `recordHistory`, `clipboardState`, `clipboardConfigure`, `clipboardSetActive`, `clipboardClear`, `clipboardWrite`, `search`, `searchFacets`, `syncStatus`, `onSyncStatus`, `onRoleChanged`, `onSearchRefreshed`. Il seam `__testInvoke` esiste solo con l'argomento di avvio `--smart-terminal-test-ipc`, abilitato dagli smoke test.

## History e clipboard (M03)
- `history:record` accetta solo `{sessionId, text, agent?}`, source fisso `assisted`, testo ≤16 KiB, `agent` ≤64 char. Testo sensibile: `{recorded:false}`. Il renderer lo chiama solo dopo un invio riuscito dall'editor; nessun keystroke o shell nativa.
- Clipboard: opt-in (default off; `SMART_TERMINAL_CLIPBOARD=1` per abilitarla all'avvio), polling 800 ms, max 32 KiB UTF-8, hash SHA-256, dedupe in memoria e contro il file, filtro segreti best-effort, pausa/clear. Associazione alla sessione attiva su tab/focus.
- `search:query` è case-insensitive, filtra macchina/sessione/data/kind, cap 100, e restituisce entry history/clipboard; l'indice è in memoria e si ricostruisce all'avvio.

## Persistenza runtime (M03)
- Repo dati: `SMART_TERMINAL_DATA_REPO` oppure `userData/data`; `sessions/<machine>/` creato localmente. Machine: `SMART_TERMINAL_MACHINE` oppure hostname normalizzato.
- `counter.md` in `sessions/<machine>/` con `schema_version`, `machine`, `last_session`, `updated_at`; prenotazione atomica sotto lock in `userData/coordinator/locks`, recovery stale, nessun riuso.
- Directory sessione `YYYY-MM-DD_HH.mm_S<n>_<local|alias>` con `session.md`, `history.md`, `clipboard.md`.
- Frontmatter comune: `schema_version: 1`, `session_id`, `machine`, `created_at`; `session.md` aggiunge `window_id`, `kind`, `ssh_alias?`, `cwd_initial`, `started_at`, `ended_at?`.
- Eventi history: `## <ISO8601> · <id>`, campi `source`, `agent?`, `cwd?`, blocco fenced `text`; clipboard: `type`, `source?`, `hash`, blocco `text`. Fence dinamica, dedupe per id/hash.
- `TerminalSessionInfo` espone `sessionId`/`label` (`S<n>`), `machine`, `sessionDirectory`, `startedAt`.
- History M03: solo invii espliciti dall'editor assistito (`source: assisted`); nessun keystroke o prompt TUI. Deviazione documentata in `docs/03`.
- Clipboard: opt-in, polling ~800 ms, hash SHA-256, limite 32 KiB, filtro segreti best-effort, pausa/cancellazione, associazione alla sessione attiva.
- Indice ricerca: rebuild all'avvio, aggiornamento sulle scritture dell'app, refresh dopo Git; solo Markdown sotto `sessions/`, niente symlink, limiti di dimensione.

## Coordinatore e Git (M04)
- Lock `userData/coordinator/primary.lock` (mkdir atomico, owner.json, heartbeat 3 s, stale 10 s, recovery con nonce); un solo primary per macchina.
- Socket Unix `userData/coordinator/coordinator.sock` (`0700`/`0600`) o named pipe Windows; token `0600`; protocollo JSON line-delimited max 1 MiB.
- Metodi: `ping`, `session.allocate`, `session.end`, `search.query`, `search.upsert`, `search.refresh`, `search.facets`, `sync.status`, `sync.dirty`, `clipboard.state`, `clipboard.configure`, `clipboard.setActive` (sessionDirectory validata), `clipboard.clear`.
- `AppRuntimeInfo.isPrimary` ed evento `app:role-changed`; evento `sync:status` con `{state,lastSyncAt?,lastError?,remoteConfigured}`; footer dinamico.
- Scheduler Git: debounce 10 s, max wait 60 s, fetch 15 s, flush a stop; env `SMART_TERMINAL_SYNC_*`.
- Git: `GitEngine` seriale, stage solo `sessions/`, commit path-scoped, fetch/rebase/push senza force, conflitti con abort e file preservati, offline con commit locale. Env: `SMART_TERMINAL_GIT_REMOTE`, `SMART_TERMINAL_GIT_BRANCH`.

## Display virtuale per gli smoke (Linux)
- Gli smoke Electron non devono usare il desktop dell'utente. `scripts/run-electron.mjs` avvia l'app su un display Xvfb dedicato (`:99` per default) e tutti gli script `test:*-smoke` e `test:layout` passano da lì.
- Su sessioni Wayland il solo `DISPLAY=:99` non basta: Electron userebbe `WAYLAND_DISPLAY` e apparirebbe sul desktop. Il wrapper rimuove `WAYLAND_DISPLAY` e forza `ELECTRON_OZONE_PLATFORM_HINT=x11`, `GDK_BACKEND=x11` e `--ozone-platform=x11`.
- `node_modules/.bin/electron` viene sostituito da uno shim (`npm run setup:test-display`, automatico via `postinstall`) che invoca lo stesso wrapper: anche un comando `electron` diretto resta su Xvfb. Per usare il desktop reale: `SMART_TERMINAL_NO_XVFB=1`.
- Ordine di ricerca di Xvfb: `SMART_TERMINAL_XVFB_BIN`, `/usr/bin/Xvfb`, `/usr/local/bin/Xvfb`, `~/.local/xvfb/usr/bin/Xvfb`. Se non è disponibile, avvisa e usa il display corrente.
- Override: `SMART_TERMINAL_XVFB_DISPLAY` (es. `:98`), `SMART_TERMINAL_NO_XVFB=1` per tornare al display corrente (sconsigliato in sessione interattiva).
- Installazione senza root: `apt-get download xvfb xserver-common xauth`, poi `dpkg-deb -x <deb> ~/.local/xvfb`; l'helper la trova in `~/.local/xvfb/usr/bin/Xvfb`.
- `scripts/capture-layout.mjs` usa lo stesso wrapper, quindi gli screenshot finiscono in `dist/layout/` senza aprire finestre sul desktop.
- In CI Linux usare `xvfb-run` o installare Xvfb; su macOS/Windows il wrapper lascia il display nativo dei runner.

## PTY
- `packages/terminal` contiene interfacce e `SessionManager` testabile; l'adapter nativo è nel subpath `@smart-terminal/terminal/node-pty` e va importato solo dal main.
- File e args sono sempre separati (mai una stringa shell composta da IPC). `cwd` deve essere assoluto ed esistente.
- `node-pty` va ricompilato per l'ABI di Electron con `npm run rebuild:native`; i test unitari usano un adapter fake e non caricano il binding.

## Comandi
| Comando | Cosa verifica |
| --- | --- |
| `npm run lint` | ESLint su TS/HTML |
| `npx tsc -p tsconfig.json --noEmit` | typecheck main/packages |
| `npm run test` | unit test Vitest (IPC, SessionManager, data schema/allocatore, runtime) |
| `npm run test:data` | test mirati del package data e del runtime dati |
| `npm run test:coordinator` | elezione multi-processo, takeover, protocollo, Git con repo bare |
| `node scripts/run-electron.mjs apps/desktop` | avvio Electron su Xvfb `:99` (usato dagli smoke) |
| `npm run build` | bundle main/preload + Angular production |
| `npm run test:ipc-smoke` | finestra Electron, API valida, rifiuto payload/canale, renderer senza Node |
| `npm run test:pty-smoke` | rebuild nativo + shell reale: output, input, resize, list, exit |
| `SMART_TERMINAL_SMOKE=1 npx electron apps/desktop` | smoke UI/IPC equivalente |
| `SMART_TERMINAL_PTY_SMOKE=1 npx electron apps/desktop` | smoke PTY (richiede rebuild nativo) |
| `npm run test:layout` | screenshot 1440x900 e 1024x700, ratio 75/25, nessun overflow (main+sidebar) |
| `npm run test:tabs-smoke` | due tab, switch senza kill, chiusura |
| `npm run test:editor-smoke` | Invio/Shift+Invio, marker eseguito, bozza svuotata, bozze per tab |
| `npm run test:sidebar-smoke` | cambio Clipboard/History, placeholder, footer sync/primary |
| `npm run test:clipboard-smoke` | opt-in, pausa, evento reale, hash, pattern sensibile ignorato |
| `npm run test:search-smoke` | invio assistito indicizzato, filtri, sensibile escluso, rebuild da disco |

## Sidebar globale e sync (M04-T04)
- History: ricerca case-insensitive con debounce ~200 ms, filtro macchina dalle facet dell'indice, voci da tutte le macchine sincronizzate, copy e inserimento nella bozza (mai invio automatico).
- Clipboard: lista delle voci catturate, copy/inserimento, controlli opt-in/pausa/clear; il polling è posseduto dal primary anche per le finestre secondary via RPC.
- Footer: `GitHub synced/syncing/offline/error`, "Repo non configurato" se manca il remote, indicatore primary dal ruolo reale.
- Refresh: evento `sync:status`/`search:refreshed`, focus finestra, polling 5 s dello stato e 15 s della lista; errori non bloccano il PTY.
- Il fetch periodico integra i commit remoti quando il working tree tracked è pulito; i prompt di un'altra macchina diventano visibili senza scritture locali.

## SSH e onboarding (M05)
- `ssh:aliases` legge `~/.ssh/config` (Include/glob); `createTerminal` accetta `{kind:'local'|'ssh', sshAlias?}`. Errori SSH non bloccano altre sessioni.
- Config: `userData/config/config.md` (override `SMART_TERMINAL_CONFIG_PATH`) con i campi di `docs/10`; onboarding `onboarding:state|validate|save|skip`, `secrets:status|logout`, `app:relaunch`.
- Secret: `safeStorage`, file `0600`; su Linux backend `basic_text`/sconosciuto o cifratura assente → solo memoria per la sessione, warning esplicito, mai plaintext.
- Env: `SMART_TERMINAL_SSH_CONFIG`, `SMART_TERMINAL_SSH_BINARY`, `SMART_TERMINAL_CONFIG_PATH`, `SMART_TERMINAL_USER_DATA`.
- Smoke: `test:ssh-smoke`, `test:onboarding-smoke`.

## Editor assistito
- Invio invia al PTY attivo; Shift+Invio inserisce newline; IME non invia. Pulsante invio abilitato solo con bozza non vuota e sessione running.
- L'invio aggiunge `\r` se assente, non supera 64 KiB UTF-8, svuota la bozza solo in caso di successo.
- Il key handler è solo sulla textarea: xterm/TUI non vengono intercettati e non esistono listener globali.
- AI correction e microfono restano disabilitati fino a M05.

## Debito noto
- Il protocollo `smart-terminal://` e `will-navigate` saranno oggetto di hardening in M06 (origin esatta, path traversal, null byte).
- Il coordinatore, la sync Git e la ricerca globale in UI non sono ancora attivi (M04).
