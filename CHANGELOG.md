# Changelog

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
