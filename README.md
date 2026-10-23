<!-- gsynchro:v1 id=8e92d508-e4e4-44bb-a3f4-16682ab1d0b2 registered=2026-10-23T09:58:42.363Z -->
<p align="center">
  <img src="apps/desktop/build/icon.png" width="96" alt="Smart Terminal" />
</p>

<h1 align="center">Smart Terminal</h1>

<p align="center"><strong>The terminal that remembers, connects, and synchronizes your work.</strong></p>

<p align="center">
  Local and SSH sessions, Markdown history and clipboard, multi-machine Git sync,<br />
  AI correction and voice dictation — all optional, all local-first.
</p>

<p align="center">
  <img src="docs/assets/screenshots/02-terminal-tabs.png" alt="Smart Terminal: two sessions, terminal, assisted input and global history sidebar" width="880" />
</p>

---

## The idea

The terminal is where technical work really happens: commands, debugging, deployments, and experiments. But its memory evaporates. Smart Terminal turns the terminal into a **personal, shareable knowledge base** without giving up shell speed.

- **Local-first**: shells, PTYs, and sessions work without a network, AI, or Git.
- **Markdown + Git as memory**: every session produces readable, versioned files rather than a proprietary database.
- **Multi-machine**: the same history and clipboard follow you between computers through the Git repository you choose.
- **AI and voice when needed**: typo correction and dictation remain optional, non-invasive, and never automatic.
- **No lock-in**: your data is files, your sync is Git, and your keys remain in the system keychain.

## A look inside

Real screenshots from the English build (1440×872 content area, Xvfb capture):

| First run | Global history | Clipboard |
| --- | --- | --- |
| <img src="docs/assets/screenshots/01-onboarding.png" alt="First-run onboarding" width="280" /> | <img src="docs/assets/screenshots/05-history.png" alt="Global history with machine filter" width="280" /> | <img src="docs/assets/screenshots/06-clipboard.png" alt="Clipboard capture" width="280" /> |

| SSH picker | AI review |
| --- | --- |
| <img src="docs/assets/screenshots/03-ssh-menu.png" alt="SSH alias picker" width="420" /> | <img src="docs/assets/screenshots/04-ai-review.png" alt="AI correction review" width="420" /> |

## Why it is different

| | Classic terminal | Smart Terminal |
| --- | --- | --- |
| Sessions | volatile tabs | persistent tabs, drafts, and per-session history |
| Memory | local scrollback | versioned and synchronized Markdown |
| Multi-machine | manual copy/paste | shared Git repository, global history |
| AI | copy/paste into chat | contextual typo correction, with review |
| Voice | external app | integrated push-to-talk, audio never persisted |
| Data | closed formats | readable files, no database |

## Features

- **Real terminal**: local PTY and SSH through OpenSSH, independent tabs, and processes that remain active in the background.
- **Frictionless SSH**: aliases are read from `~/.ssh/config` (including `Include`), the system agent is used, and no keys are copied.
- **Assisted input**: multiline editor, separate draft per tab, `Enter` sends, `Shift+Enter` inserts a line break.
- **Optional AI correction**: Anthropic, OpenAI, or an OpenAI-compatible endpoint; corrects typos only, preserves commands/paths/code, and requires review.
- **Dictation**: local or cloud STT, push-to-talk, editable result in the draft; no audio is saved.
- **History and clipboard**: global search, machine filter, copy/reinsert; opt-in clipboard with pause and secret filters.
- **Git sync**: debounce, periodic fetch, rebase/push without force, conflicts that preserve files, and always-visible status.
- **Multi-instance**: primary/secondary coordinator per machine, recoverable lock, and atomic session IDs.
- **Privacy by design**: tokens in the keychain, no secrets in shared Markdown, and non-blocking AI/STT.

## Install Smart Terminal

- [Windows installation guide](docs/20%20-%20Windows%20installation%20guide.md)
- [Linux installation guide](docs/21%20-%20Linux%20installation%20guide.md)
- [macOS installation guide](docs/22%20-%20macOS%20installation%20guide.md)

## First run

1. **Data repository and machine** — choose where to keep Markdown files and a machine name.
2. **AI provider (optional)** — provider, model, and token in the keychain.
3. **Voice (optional)** — local/cloud STT and microphone check.

You can skip AI and voice: the terminal remains fully usable. Non-secret configuration lives in `userData/config/config.md`; tokens never enter Markdown files.

## Data and synchronization

```text
sessions/
  <machine>/
    counter.md
    YYYY-MM-DD_HH.mm_S<n>_<local|ssh-alias>/
      session.md
      history.md
      clipboard.md
```

The session repository is separate from the code repository. Smart Terminal does not use a database: files are the source of truth, and history is Git. The shell's native history is not intercepted: explicit submissions from the assisted editor are recorded, never keystrokes or TUI prompts.

## Security and privacy

- AI/STT tokens stay in the main process, encrypted with the keychain/`safeStorage`; on Linux with the `basic_text` backend they remain in memory only.
- Opt-in clipboard, with pause, clear, and best-effort secret filters.
- No persistent audio recording.
- AI and STT never execute commands and never block the terminal.
- Details and residual risks: [Security checklist](docs/13%20-%20Security%20checklist.md).

## Development

Requirements: **Node.js 24**, Git, OpenSSH. Linux smoke tests require Xvfb (the wrapper uses a virtual display and never the desktop).

```bash
npm ci
npm run dev          # Angular + Electron in development
npm run build
npm run test         # unit + integration (395 tests)
npm run test:e2e     # two Electron instances, failover, and cross-machine
npm run lint
npx tsc -p tsconfig.json --noEmit
```

Packaging:

```bash
npm run package:linux   # AppImage + .deb
npm run package:mac     # .dmg (macOS runner)
npm run package:win     # NSIS installer (Windows runner)
npm run checksums       # release/SHA256SUMS
```

GitHub Actions CI (`.github/workflows/ci.yml`) covers Linux/macOS/Windows; the `release.yml` workflow publishes artifacts for `v*` tags.

## Architecture

```text
apps/desktop/       Electron main/preload and packaging
apps/renderer/      standalone Angular UI
packages/contracts/ typed IPC contracts
packages/terminal/  PTY, SSH, session lifecycle
packages/data/      Markdown, ID allocation, in-memory search
packages/sync/      primary/secondary coordinator, Git
packages/ai/        AI and STT providers
```

- Isolated renderer (`contextIsolation`, `sandbox`, `nodeIntegration: false`), with a whitelisted preload API.
- Local coordinator with OS lock, heartbeat, and takeover; one Git writer per machine.
- Volatile, rebuildable search index with no database.

## Documentation

- [Post-install onboarding](docs/14%20-%20Post-install%20onboarding.md)
- [User manual](docs/12%20-%20User%20manual.md)
- [Windows installation guide](docs/20%20-%20Windows%20installation%20guide.md)
- [Linux installation guide](docs/21%20-%20Linux%20installation%20guide.md)
- [macOS installation guide](docs/22%20-%20macOS%20installation%20guide.md)
- [Repository setup guide](docs/18%20-%20Repository%20setup%20guide.md)
- [AI provider setup guide](docs/19%20-%20AI%20provider%20setup%20guide.md)
- [STT setup guide](docs/17%20-%20STT%20setup%20guide.md)
- [Release notes](RELEASE_NOTES.md)
- [Agent workflow](docs/WORKFLOW.md)
- [Build and release](docs/09%20-%20Build%20and%20release.md)
- [IPC contracts](docs/11%20-%20IPC%20contracts%20and%20runtime%20verification.md)
- [Security checklist](docs/13%20-%20Security%20checklist.md)

## Status and known limitations

v1.1.0 is a complete desktop release tested on Linux; macOS/Windows are covered by the CI pipeline. Declared limitations: native shell history is not covered, secret filters are heuristic, Windows named pipes lack dedicated ACLs, artifact signing is unavailable, and there is no auto-update.

## License

No license is specified in the repository.
