---
title: "User manual"
type: manual
project: smart-terminal
created: 2026-10-23
---
<!-- gsynchro:v1 id=e7e31832-14ad-4df3-bf01-16b6e5b9d439 registered=2026-10-23T09:58:42.366Z -->

# My Smart Terminal v1.3.17 — User manual

## Next step: post-install onboarding

New users should follow the [Post-install onboarding guide](14%20-%20Post-install%20onboarding.md) for first launch, local and SSH sessions, optional AI/STT, clipboard privacy, and Git troubleshooting.

## 1. What it is

My Smart Terminal is a multi-instance desktop terminal: each tab is an independent PTY session, local or SSH. It provides assisted input, per-tab drafts, browsable history and clipboard, Markdown sessions, and Git synchronization. A local coordinator assigns IDs and serializes writes and Git; a window can be primary or secondary.

AI typo correction and speech recognition (STT) are optional. Shell and PTY continue to work without network, AI, or Git.

## 2. Installation

Use the guide for your operating system:

- [Windows installation guide](20%20-%20Windows%20installation%20guide.md)
- [Linux installation guide](21%20-%20Linux%20installation%20guide.md)
- [macOS installation guide](22%20-%20macOS%20installation%20guide.md)

Release artifacts are unsigned, so the operating system may show a warning. Verify the published checksum before installing. There is no automatic update; updates are manual. Development features require Node.js 24, Git, and OpenSSH. SSH uses the system client and `~/.ssh/config`.

## 3. First launch and onboarding

At first launch, the wizard offers three steps:

1. **Data repository and machine** — choose the data clone/repository path and a machine name. If setup is skipped, a default local repository is used; the terminal remains usable.
2. **AI provider and token** — choose Anthropic, OpenAI, or OpenAI-compatible, optionally set the base URL/model, and save the token in the system keychain. On Linux, if the backend is `basic_text` or unavailable, the token is kept in memory for the session only: it is never written in plaintext.
3. **STT and microphone** — choose the shared AI provider, a specific OpenAI-compatible provider, or none; configure as needed, check the microphone, and grant permission. This step can be skipped.

Non-secret configuration is in `userData/config/config.md` (typically under `~/.config/...` on Linux, `~/Library/Application Support/...` on macOS, and `%APPDATA%/...` on Windows). It is not synchronized. Tokens are managed by main through `safeStorage`/keychain and are not placed in Markdown; without a secure keyring there is no plaintext fallback. After first-run onboarding, the header wrench opens Settings with **Repository**, **AI**, **STT**, and **Appearance** tabs; the adjacent AI Actions wand opens its own manager modal. See the [post-install onboarding guide](14%20-%20Post-install%20onboarding.md) for title, menu, and zoom behavior.

Configuration uses `schema_version: 1`. If it is unreadable or unknown, the app keeps a `.bak` backup of the last valid configuration or quarantines the corrupt one as `.corrupt`, then restarts with safe defaults.

## Appearance

Dark is the default. Choose Light explicitly in Settings → Appearance when desired; there is no operating-system-following mode.

## 4. Daily use

The shell header is a 35 px full-window bar with a transparent icon and dynamic `Smart Terminal - Version <runtime version>` title. Its controls are ordered AI Actions wand, Settings wrench, then layout toggle. Session tabs are 38 px high. **History** and **Clipboard** are header toggles: selecting one shows that sidebar surface, and selecting the active one hides the sidebar. The assisted input is a single-border composer. Settings uses **Repository**, **AI**, **STT**, and **Appearance** tabs in a dialog sized `min(640px, 92vw)` × `min(744px, 90vh)`. Appearance provides a **Theme** selector (**Dark** or **Light**) and the existing terminal-font selector. Theme changes preview live; **Save** persists them, while **Cancel** restores the saved theme and font (discard confirmation may appear for unsaved edits). Both preferences are stored in the machine-local `config.md`, not synchronized. Light theme changes the interface and terminal palette; it does not alter terminal font selection. Older app versions reject unknown config keys and may warn/reject this configuration on downgrade; do not assume downgrade compatibility.

### Tabs and sessions

- Press `+` and choose **Local** or an SSH alias read from `~/.ssh/config` (compatible `Include` and globs are also supported).
- Switching tabs does not terminate the PTY: the process, output, and draft remain associated with the session.
- Closing a tab terminates its PTY cleanly and updates `session.md`; confirmation is requested when needed.
- An SSH error affects only that session and does not block others.

### Assisted input

Each tab has an independent draft. **Enter** deliberately sends the text to the PTY; **Shift+Enter** inserts a newline. The draft is cleared only after a successful submission. The xterm terminal remains directly usable: keys and TUI prompts are not intercepted by the editor.

![AI actions modal with an action select and editable System and User prompts](assets/screenshots/09-ai-actions.png)

The composer AI trigger shows only sparkles and has the accessible name **AI actions**. It opens the separate AI Assistant modal, sized to 90% of the window. System and User prompts fill the left pane equally (50/50); the Answer pane fills the right side. Its one-row **Answer** label and **Rendered**/**Raw** toolbar control the view. The last selected action is remembered locally. The action selector also offers an optional model select with **Refresh**; **Provider default** omits a model and discovered chat models are selectable. Audio/transcription models are excluded. A previously saved model remains visible only if it is no longer in the discovered list. Claude Platform and DeepSeek Platform presets fill the provider base URL. **Use** inserts the selected answer text (rendered or raw, depending on the view) or the full answer when there is no selection. It never submits the composer or executes anything. The header wand opens the AI Actions manager, which is 10% taller than before. It lists built-in and custom actions, shows `BUILT-IN:n CUSTOM:n` in its bordered footer, and supports adding actions and deleting custom actions after confirmation. There is no bulk Reset; built-in templates can be reset per action. Templates can include terminal context such as the on-demand console excerpt and `{{clipboard}}` (system clipboard text at compose time, capped at 16,000 characters). See [AI prompt templates and storage](36%20-%20AI%20prompt%20templates%20and%20storage.md) for limits and privacy details.

### AI/STT provider settings

In Settings → AI, fields appear in this order: **AI Provider**, **Base URL**, **Token**, **Model**, **Test AI**. The provider choices are **OpenAI Compatible**, **Claude Platform**, and **DeepSeek Platform**, plus **None**; legacy **OpenAI** and **Anthropic** values appear only when already saved. Claude Platform and DeepSeek Platform presets fill their base URLs. Settings → STT offers **Use same AI provider**, **Use Specific Provider** (provider choices **DeepSeek Platform** and **OpenAI Compatible**), or **None**; its model list is limited to audio/transcription models. Design-system spacing is applied to settings fields. Existing local configurations remain visible/selectable as legacy, but Local command is not offered as a new option.

### Microphone

Hold the push-to-talk control. States are `Voice ready`, `Listening…`, `Transcribing…`, and any error. The transcription enters the editable draft and is not sent automatically; changing tabs or closing the window interrupts and discards the current audio.

### History and Clipboard

The sidebar alternates between **History** and **Clipboard**.

- History: search text, filter by machine, copy, insert into the draft, or delete an entry with the trash icon at the bottom-right of its card. V1 records explicit assisted-editor submissions; native shell history is not recorded generally.
- Clipboard: capture is opt-in. It can be paused, cleared, searched, copied, inserted into the draft, or deleted per entry with the trash icon. Insertion never sends automatically.

The footer shows Git status (`synced`, `dirty`, `syncing`, `offline`, `error`) and the `primary`/`secondary` role. Application zoom is **Ctrl/Cmd-minus**, **Ctrl/Cmd-plus** (including `Ctrl+=`), and **Ctrl/Cmd-0**; the narrow terminal shortcut limitation is documented in the [keyboard behavior ADR](23%20-%20ADR%20assisted%20input%20and%20terminal%20keyboard%20behavior.md).

## 5. Data and synchronization

The app creates this structure in the data repository:

```text
sessions/<machine>/counter.md
sessions/<machine>/<date-time>_S<n>_<local|ssh-alias>/
  session.md
  history.md
  clipboard.md
```

`S<n>` is sequential per machine and is never reused. Markdown writes are local and immediate. History is **assisted-only**: input typed directly in the shell is not recorded, except where reliable shell integration is already present; keystrokes and TUI prompts are not intercepted. Clipboard is opt-in, can be paused or cleared, and filters are best-effort.

The repository can be a Git clone with configurable remote and branch. The coordinator runs fetch, commit, rebase, and push serially; normally it uses a 10 s debounce, 60 s maximum wait, and fetch every 15 s. Without a remote, **Repo not configured** is shown: files remain local. Offline mode creates local commits and does not block the terminal. After a rejected push, a limited fetch/rebase/retry is attempted; on conflict, sync stops with an error and preserves files. Force-push is never used.

## 6. Privacy and security

- AI/STT tokens: keychain/`safeStorage` only, never in the repository or renderer.
- Do not save passwords, private keys, or other secrets in Markdown.
- History and clipboard filters recognize common patterns, but are heuristic and cannot guarantee detection of every secret.
- Clipboard is disabled until enabled; STT audio remains in memory, with no persistent files.
- AI/STT have timeouts and fallbacks: their unavailability does not block PTY, shell, submission, or local writes.
- The Git data repository is trusted: Git can execute hooks/configuration from the selected repository. Do not use untrusted repositories.

## 7. Troubleshooting

- **Repo not configured**: set a remote/branch in configuration or continue locally; Git is not required for PTY.
- **Rejected push or conflict**: wait for automatic fetch/rebase; if `error` remains, preserve local files, resolve the conflict with Git, and retry without force-push.
- **SSH unreachable**: check the alias, network, agent, and `~/.ssh/config` with `ssh <alias>`; the app does not copy private keys.
- **Microphone denied**: enable permission in system settings, restart if requested, or use the keyboard.
- **AI/STT unavailable**: check the provider, token, endpoint, and absolute local command; the terminal remains operational.
- **Secondary/primary**: `secondary` is normal with multiple windows. Takeover occurs only when the primary no longer responds; do not close a working primary to force it.
- **Stale lock**: after a crash, the new primary recovers the lock when the previous process is no longer alive; wait for takeover and do not manually delete files while the app is active.
- **Missing keyring**: on Linux, the token is not persisted and can be used only in memory for the session; configure a secure keyring for persistent cloud use.
- **Logs**: look for Electron process output and app logs in the user data directory; logs must not contain tokens, audio, or AI text. Interface errors are sanitized.
- **AppImage and FUSE**: if the AppImage does not start, run `"$HOME/.local/bin/smart-terminal"` (for the script-installed AppImage; see the [Linux installation guide](21%20-%20Linux%20installation%20guide.md))..

## 8. V1 limits and compatibility

V1 does not generally record native shell history, guarantee detection of every secret, auto-update, or sign artifacts. Windows named pipes use token authentication but no dedicated ACLs. AI/STT depend on the provider, keyring, and network when cloud-based.

Configuration and Markdown files use `schema_version: 1`. Before upgrading from a pre-1.0 version, copy the data repository and configuration. The app creates `.bak` backups of valid configuration and `.corrupt` quarantine for invalid data; it does not destructively modify synchronized content.

## 9. Development, testing, and packaging

The repository is an npm workspaces monorepo:

```bash
npm ci
npm run dev
npm run build
npm run test
npm run test:e2e
```

On Linux, Electron smoke tests use Xvfb, normally `:99`, through `scripts/run-electron.mjs`; do not launch Electron on the user's desktop. For an explicit smoke test, for example:

```bash
npm run test:ipc-smoke
npm run test:pty-smoke
```

Packaging commands are platform-specific:

```bash
npm run package:linux
npm run package:mac
npm run package:win
```

They use electron-builder and produce AppImage/.deb, `.dmg`, or an NSIS installer respectively. `npm run package` remains available for generic packaging. After packaging, run `npm run checksums` and publish SHA-256 checksums with the artifacts.

## 10. References

- [Vision and scope](00%20-%20Vision.md)
- [Architecture](01%20-%20Architecture.md)
- [UI and sessions](02%20-%20UI%20and%20sessions.md)
- [Markdown contract](03%20-%20Markdown%20schema.md)
- [Git synchronization](04%20-%20Sync%20Git.md)
- [AI, voice, and security](05%20-%20AI%2C%20voice%20and%20security.md)
- [Stack and code structure](06%20-%20Stack%20and%20code%20structure.md)
- [Runtime logic](07%20-%20Runtime%20logic.md)
- [UX and interactions](08%20-%20UX%20and%20interactions.md)
- [Build and release](09%20-%20Build%20and%20release.md)
- [Local configuration, coordinator, and runtime security](10%20-%20Local%20config%2C%20coordinator%20and%20runtime%20security.md)
- [IPC contracts and runtime verification](11%20-%20IPC%20contracts%20and%20runtime%20verification.md)
- [Security checklist](13%20-%20Security%20checklist.md)
- [Workflow](WORKFLOW.md)
