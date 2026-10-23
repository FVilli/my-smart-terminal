---
title: "Contratti IPC e verifica runtime"
type: contract
project: smart-terminal
version: 1
created: 2026-10-23
---

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

Eventi: `terminal:data` (`{ sessionId, data }`), `terminal:exit` (`{ sessionId, exitCode, signal? }`). Ogni finestra ha il proprio `SessionManager`; alla chiusura/distruzione i PTY vengono terminati.

## API preload
`ping`, `runtimeInfo`, `createTerminal`, `writeTerminal`, `resizeTerminal`, `closeTerminal`, `listTerminals`, `onTerminalData`, `onTerminalExit`. Il seam `__testInvoke` esiste solo con l'argomento di avvio `--smart-terminal-test-ipc`, abilitato dagli smoke test.

## PTY
- `packages/terminal` contiene interfacce e `SessionManager` testabile; l'adapter nativo è nel subpath `@smart-terminal/terminal/node-pty` e va importato solo dal main.
- File e args sono sempre separati (mai una stringa shell composta da IPC). `cwd` deve essere assoluto ed esistente.
- `node-pty` va ricompilato per l'ABI di Electron con `npm run rebuild:native`; i test unitari usano un adapter fake e non caricano il binding.

## Comandi
| Comando | Cosa verifica |
| --- | --- |
| `npm run lint` | ESLint su TS/HTML |
| `npx tsc -p tsconfig.json --noEmit` | typecheck main/packages |
| `npm run test` | unit test Vitest (IPC, SessionManager) |
| `npm run build` | bundle main/preload + Angular production |
| `npm run test:ipc-smoke` | finestra Electron, API valida, rifiuto payload/canale, renderer senza Node |
| `npm run test:pty-smoke` | rebuild nativo + shell reale: output, input, resize, list, exit |
| `SMART_TERMINAL_SMOKE=1 npx electron apps/desktop` | smoke UI/IPC equivalente |
| `SMART_TERMINAL_PTY_SMOKE=1 npx electron apps/desktop` | smoke PTY (richiede rebuild nativo) |

## Debito noto
- Il protocollo `smart-terminal://` e `will-navigate` saranno oggetto di hardening in M06 (origin esatta, path traversal, null byte).
- La persistenza Markdown, gli ID atomici, il coordinatore e la sync Git non sono ancora attivi (M03/M04).
