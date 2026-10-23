<!-- gsynchro:v1 id=049deca4-b206-4a13-b4dc-da86368ac628 registered=2026-10-23T09:58:42.364Z -->
# Release notes

## v1.0.0

First user release of My Smart Terminal. Release date: not specified.

### Features

This release completes modules M01–M06:

- multi-instance Electron desktop terminal with local and SSH PTY tabs;
- sessions and metadata persisted in Markdown, per-machine counter, and search;
- assisted-submission history and opt-in clipboard, with pause, clear, and filters;
- local primary/secondary coordinator, heartbeat lock, takeover, and safe ID allocation;
- serialized Git synchronization, fetch/rebase/push without force-push, offline/error states, and conflict preservation;
- onboarding for the data repository, machine name, AI provider, and STT;
- optional AI correction for typos only, with review before submission;
- local/cloud push-to-talk STT, audio held in memory only, and non-blocking microphone;
- Electron/IPC hardening, path validation, secret protection, and runtime tests.

### Installation and platforms

The following electron-builder artifacts are planned:

- Linux: AppImage and `.deb`;
- macOS: `.dmg`;
- Windows: `.exe` installer.

After installing on Linux, launch **Smart Terminal** from the applications menu or run `"/opt/Smart Terminal/smart-terminal"`; the AppImage runs directly. On macOS open the app from Applications, on Windows from the Start menu.

Verify the SHA-256 checksum published with each artifact. Artifacts are **unsigned** until macOS/Windows certificates are available (and no signature should be assumed). V1 includes no auto-update: updates are manual.

### Known limitations

- Native shell history is not generally covered: explicit submissions from the assisted editor are recorded, not keystrokes or TUI prompts.
- History/clipboard filters are best-effort and heuristic: they cannot necessarily identify every secret.
- Windows named pipes use token authentication but do not have dedicated ACLs.
- `safeStorage` depends on the system keyring; on Linux with the `basic_text` backend or without encryption, tokens remain in memory only.
- Git can execute hooks and data-repository configuration: choose a trusted repository and do not clone untrusted repositories for use as data repositories.
- Cloud AI/STT depends on the network, provider, microphone permissions, and keyring availability; these services are not required for the terminal.
- Auto-update and artifact signing are not available in this release.

### Migration from pre-1.0 versions

Before upgrading, back up the data repository and local configuration. V1 uses `schema_version: 1` for configuration and Markdown. Configuration is stored in `userData/config/config.md` and is not synchronized; tokens and secrets remain outside Markdown files.

When invalid configuration is detected, the app preserves a `.bak` backup of the last valid version or moves the file to `.corrupt`, then applies safe defaults. Synchronized Markdown content is not modified destructively: check the backup and resolve any Git conflicts manually.
