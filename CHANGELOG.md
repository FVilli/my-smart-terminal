<!-- gsynchro:v1 id=d96cce88-411a-46c3-bb63-e76b0b4b1fb6 registered=2026-10-23T13:00:27.384Z -->
# Changelog

## 1.3.1
### Fixed
- Composer background/monospace/icons/mic status and hidden unconfigured audio label.
- Transparent Ubuntu/menu icon.
- Single active/inactive right-panel toggle.

## 1.3.0
### Added
- Full-window 35px VS Code-style header, panel toggles, custom window controls and transparent icon.
- Single-border composer with AI/mic/send inside bottom-right.

### Changed
- 38px session tabs, updated palette/baseline.

## 1.2.2
### Fixed
- Copy selected terminal text via Ctrl+Shift+C, Cmd+C or Ctrl+Insert.
- Reopen Settings after save/dismiss; reset settings state on close.

## 1.2.1
### Fixed
- Versioned window title is no longer overwritten by the HTML title.
- Settings opens immediately from the header gear during state loading.

## 1.2.0

### Added
- Composer focus shortcut/back-to-terminal behavior and tabbed Settings with Appearance/font.
- Self-hosted AI and STT configuration, including `/v1`, custom models, `verbose_json`, language and test-before-save.
- New Linux/README branding and runtime icon.

### Changed
- Removed non-essential application menus, versioned title, unified palette, zoom shortcuts.

### Fixed
- Ctrl+plus zoom, package/menu icon, AI Test-before-save and CI Linux-only verification.

## 1.1.1

### Added
- One-command Linux install and uninstall scripts, supporting `.deb` and per-user AppImage installation.
- Ubuntu menu integration and refreshed icon/README logo.

### Changed
- Installation verifies SHA-256 checksums and applies safety checks.

### Fixed
- Uninstall preserves configuration, sessions, and external repositories.

## 1.1.0

### Added
- Reopenable settings wizard with reversible navigation and dirty-state confirmation.
- Repository registration verification with a real path-scoped commit/push and `instances/` metadata.
- AI provider and STT transcription setup tests.
- Repository, AI and STT setup guides with real screenshots and in-app help links.
- Linux desktop-entry package verification.

### Changed
- Shell aligned with the approved mock: 48 px header, 54 px tab bar with `#384a5d` active tab, black sidebar, taller input, terminal-background footer.
- Git synchronization scope is now `sessions/` + `instances/`.
- CI includes setup smokes and Markdown link checks.

### Fixed
- Setup can be reopened and navigated back/forward; Cancel/Escape and restart behavior are consistent.
- Linux menu entry is verified in the generated `.deb`.

## 1.0.0
- First public release: Electron/Angular terminal, PTY local/SSH, Markdown sessions/history/clipboard, Git sync, AI correction, STT, onboarding, Linux/macOS/Windows artifacts.
