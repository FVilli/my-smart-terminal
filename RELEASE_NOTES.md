<!-- gsynchro:v1 id=049deca4-b206-4a13-b4dc-da86368ac628 registered=2026-10-23T09:58:42.364Z -->
# Release notes

## v1.3.4

Composer regression hotfix.

### Fixed

- Composer AI/mic/send controls are anchored bottom-right again after the hint was moved into the placeholder.
- Editor and placeholder now explicitly share the same monospace family and weight; typed text remains white and the hint stays muted.

## v1.3.3

Interaction and settings polish release.

### Added

- STT option **Use same AI provider (OpenAI-compatible)**, reusing the AI tab base URL and keychain token while keeping STT model/format/language separate.
- Contextual GitHub guide link in the Settings footer with GitHub icon.

### Changed

- New-session menu is denser; SSH is visually stronger than the alias.
- Composer hint now lives inside the field as a placeholder; typed text is white and monospace.
- Settings has a fixed height, scrollable body and standard `[Cancel] [Save]` order.
- Clicking the microphone with STT unconfigured opens Settings directly on the STT tab.

### Fixed

- No visible “STT not configured” text; microphone state is faded/configured/recording.
- Composer surrounding area matches the app background.

## v1.3.2

Composer background hotfix.

### Fixed

- The area outside the composer border now uses the terminal/app background; only the composer interior uses the input background. This removes the unwanted same-color band around the field.

## v1.3.1

Visual fixes release.

### Fixed

- Composer now shares its input background outside the border, uses explicit monospace text, cleaner SVG AI/mic/send icons, hides the “not configured” voice text and distinguishes configured/active microphone states.
- Ubuntu menu/window icon now uses the transparent RGBA asset instead of an opaque square.
- Right side panel is controlled by one toggle icon with distinct active/inactive variants; it remembers the last History/Clipboard section.

## v1.3.0

Header and composer redesign release.

### Added

- Full-window VS Code-inspired 35px title bar: transparent app icon, centered runtime version, Settings gear, History/Clipboard panel toggles and `_ □ ×` window controls on Linux/Windows.
- Right-panel visibility controls synchronized with History/Clipboard tabs; terminal expands when hidden.
- Custom window-control IPC with maximize/restore state.
- Transparent-background application icon.
- Single-container composer with 8px rounded border; AI, microphone and send controls inside bottom-right.

### Changed

- Session tabs reduced to 38px and moved directly below the title bar.
- macOS preserves native traffic lights; Linux/Windows use the custom frame.
- Palette and visual baseline updated for the new shell.

### Fixed

- Header version/title visibility and second-open Settings behavior carried forward from 1.2.x.
- Composer keyboard, IME, AI and STT semantics preserved.

## v1.2.2

Hotfix release.

### Fixed

- Terminal text can be selected and copied with Ctrl+Shift+C, Cmd+C or Ctrl+Insert through the main-process clipboard.
- The Settings gear now reopens after Save and after dismissing the restart notice; the settings store is reset on every close path.

### Verification

- Added terminal-copy shortcut/copy tests and a second-open-after-Save assertion in the settings smoke.
- Patch release; no data migration required.

## v1.2.1

Hotfix release.

### Fixed

- The window title now keeps the versioned title (`Smart Terminal - Version 1.2.1`) instead of being overwritten by the renderer document title.
- The header gear now opens the Settings dialog immediately, even while configuration state is loading.

### Verification

- Settings smoke asserts the versioned window title and immediate gear opening.
- Patch release; no data or configuration migration required.

## v1.2.0

Input, settings and self-hosted providers release.

### Added

- Input-surface keyboard contract: Ctrl/Cmd+Shift+E focuses the composer, Escape returns to the terminal without losing the draft, and the composer keeps focus after sending.
- Tabbed Settings after first run: Repository, AI, STT and Appearance; Appearance includes persisted terminal monospace font selection.
- Self-hosted OpenAI-compatible AI configuration with `/v1` base URL, custom models, test-before-save, and sanitized HTTP diagnostics.
- Self-hosted STT configuration with base URL, custom model, `verbose_json` response format and language.
- New Linux application/README branding and runtime window icon.

### Changed

- Removed the File/Edit/View/Window menu on Linux/Windows; macOS keeps only the essential application menu.
- Window title now includes the runtime version.
- Sidebar and history/clipboard palette unified with the terminal/input surfaces.
- Zoom via Ctrl/Cmd+minus/plus/0, including keyboard/numpad variants.

### Fixed

- Ctrl/Cmd+plus zoom now works alongside zoom-out and reset.
- The Linux package/menu uses the Smart Terminal icon instead of the stock Electron icon.
- AI Test uses the current unsaved wizard values and entered token, so it works before saving.
- CI Linux-only script verification and packaging-icon tracking.

## v1.1.1

Linux installation and branding release.

### Added

- One-command Linux install and uninstall scripts, with Debian/Ubuntu `.deb` and per-user AppImage support.
- Ubuntu applications-menu entry and icon, plus refreshed application icon and README logo.

### Changed

- Install scripts verify published SHA-256 checksums and use safety checks before installation or removal.

### Fixed

- Uninstall preserves configuration, sessions, and external data repositories.

## v1.1.0

Layout, settings and verified setup release.

### Added

- Reopenable settings wizard from a header gear icon, with Back/Next/Cancel, Escape, dirty confirmation and restart guidance only for repository/machine/remote changes.
- Real “Test repository” setup verification: writes `instances/<machine>-<installation-id>.md`, commits path-scoped and pushes to the configured remote (local-only when no remote; recoverable failure keeps the local commit).
- “Test AI” provider verification and “Test transcription” STT verification in the wizard, with no automatic submission and no persisted audio.
- In-app help links for repository, AI and STT setup, mapped to fixed documentation URLs.
- Repository, AI provider and STT setup guides with real English screenshots.
- Linux desktop entry/package verification in CI.

### Changed

- Layout aligned with the approved mock: 48 px header, 54 px tab bar with `#384a5d` active tab, black sidebar, taller assisted input and terminal-background footer.
- Git scope extended to `sessions/` and `instances/`; unrelated paths are still never staged.
- New setup smoke tests and Markdown link checker in CI.

### Fixed

- Setup is no longer trapped: every step can go back/forward and Cancel/Escape works.
- Settings can be reopened after onboarding.
- Linux packages expose a verified application-menu entry and icon.

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

The following v1.0.0 artifacts are published on GitHub Releases:

- Linux x86_64: `Smart.Terminal-1.0.0-linux-x86_64.AppImage` and `Smart.Terminal-1.0.0-linux-amd64.deb`;
- macOS Apple Silicon: `Smart.Terminal-1.0.0-mac-arm64.dmg`;
- Windows x64: `Smart.Terminal-1.0.0-win-x64.exe`;
- `SHA256SUMS` for all artifacts.

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
