<!-- gsynchro:v1 id=d96cce88-411a-46c3-bb63-e76b0b4b1fb6 registered=2026-10-23T13:00:27.384Z -->
# Changelog

## 1.3.17
### Changed
- Settings/AI field order is AI Provider, Base URL, Token, Model, Test AI.
- AI providers shown are OpenAI Compatible, Claude Platform and DeepSeek Platform (plus None); legacy OpenAI/Anthropic values remain selectable only when already saved.
- Settings/STT no longer offers Local command; specific STT providers are DeepSeek Platform and OpenAI Compatible.
- Byte counters are right-aligned, muted and smaller; BUILT-IN/CUSTOM counts align right; AI Actions header is inline; Answer spans the AI action and User prompt rows.
- Save/Reset/Delete and Send use icons with flex gaps.
### Notes
- Existing local STT and OpenAI/Anthropic AI configurations keep loading; they are legacy options only.
- Linux AppImage/deb, macOS arm64 dmg and Windows x64 installer are published with SHA256SUMS; artifacts are unsigned.

## 1.3.16
### Added
- `{{clipboard}}` placeholder for AI actions, read from the system clipboard at compose time (capped, never stored).
- Claude Platform and DeepSeek Platform AI providers with automatic base URLs.
- AI model discovery: the optional model is now a select with refresh (Provider default, discovered, Custom).
- STT "Use Specific Provider (OpenAI-compatible)" with provider, base URL, keychain token and model refresh, plus Local command and None.
### Changed
- AI Assistant prompts fill their panes 50/50, the answer uses the full height, and the Answer label sits beside the Rendered/Raw toggle on one row.
- The assistant preselects the last used action.
### Fixed
- Specific-provider STT uses its own base URL and `stt:cloud` token, never the AI token.
### Notes
- Linux AppImage/deb, macOS arm64 dmg and Windows x64 installer are published with SHA256SUMS; artifacts are unsigned.

## 1.3.15
### Changed
- The composer AI trigger shows only the sparkles glyph; the AI Assistant modal is 90% of the window (width and height) with a compact header and 50/50 columns (prompts left, answer right).
- The AI Actions manager is 10% taller (792 px, 90 vh cap).
- Answers render as safe Markdown with a Rendered/Raw toggle; Use inserts the rendered or raw selection (or the whole answer) without submitting.
### Fixed
- Answer selection is now captured only inside the rendered pane, falling back to the raw textarea selection.
### Notes
- Linux AppImage/deb, macOS arm64 dmg and Windows x64 installer are published with SHA256SUMS; artifacts are unsigned.

## 1.3.14
### Changed
- AI Actions now live in a dedicated modal opened from the header, with the settings dialog narrowed to four tabs and made 20% taller.
- Header action order is AI Actions (wand), Settings (wrench), layout toggle; window controls unchanged.
- AI Actions list footer keeps only the separator, the add button and a tiny BUILT-IN/CUSTOM counter; the bulk Reset was removed (per-action reset remains).
### Fixed
- Deleting a custom AI action requires confirmation; built-in actions cannot be deleted.
- Focus returns to the header wand on any AI Actions modal close, including programmatic closes.
### Notes
- Linux AppImage/deb, macOS arm64 dmg and Windows x64 installer are published with SHA256SUMS; artifacts are unsigned.

## 1.3.13
### Added
- AI actions modal with five actions (suggest, explain, risk, fix, rewrite) and session OS/shell context persisted in `session.md` (local exact, SSH best-effort with `unknown` fallback).
- Editable System/User prompt templates per action and custom actions in Settings → AI actions (local `ai-actions.json`), placeholders including bounded terminal console context.
- Explicit Dark/Light themes (dark default) in Settings → Appearance, applied before first paint; terminal font selection retained.
- Reusable accessible TabsContainer for settings; card-based AI Actions list with add and confirmed built-in reset.
### Fixed
- GitHub guide links now copy the URL when no browser can be opened; wider settings dialog (+60%); masked stored-token hint; "Speech to Text provider" label and aligned model refresh button; tab/token ARIA fixes.
- AI template store now persists before publishing state, so failed writes never become authoritative.
### Notes
- `terminal_theme` is local config; older versions may warn/reject the new key.
- Linux AppImage/deb, macOS arm64 dmg and Windows x64 installer are published together with SHA256SUMS; artifacts are unsigned.

## 1.3.12
### Added
- Dynamic STT model discovery from the audio endpoint, with loaded state and model test details.
- Unsloth Qwen ASR model support, model refresh control, and standalone SDK transcription diagnostic.
### Fixed
- Multipart STT uploads use the audio filename extension expected by the server.
- Composer mic is a toggle with a 2s red recording pulse and inserts the transcript at the caret.
- Restored STT test control icons and table styles.
### Changed
- STT provider can use the server default model (model field omitted).
- Fast local deb build/verification path for release testing.

## 1.3.11
### Added
- STT test debug audio file with visible path; 0600 in userData/stt-debug.
### Fixed
- Blob playback via native player.

## 1.3.10
### Fixed
- Blob audio CSP and native STT sample player/playback diagnostics.

## 1.3.9
### Added
- STT REC/STOP/PLAY/TRANSCRIBE flow and sanitized provider diagnostics.
### Fixed
- Audio permission/device handling and REC independent from AI config.

## 1.3.8
### Fixed
- Central message area moved into the bottom status footer.

## 1.3.7
### Added
- Central message area; REC/STOP/PLAY/TRANSCRIBE STT test.
### Fixed
- Composer font stack/inline binding and GitHub help error routing.

## 1.3.6
### Changed
- Full-height scrollable composer editor and right-side vertical action column; inline terminal-font binding.

## 1.3.5
### Changed
- Minimal shared-AI STT UI, compact menu, fixed settings, footer GitHub link, in-field composer hint.
### Fixed
- Shared AI STT test, composer alignment/font.

## 1.3.4
### Fixed
- Composer controls right alignment and explicit shared mono font for text/placeholder.

## 1.3.3
### Added
- Shared AI provider option for STT; GitHub guide footer link.
### Changed
- Compact session menu, in-field composer hint, fixed-height settings, mic-to-STT settings.

## 1.3.2
### Fixed
- Composer surrounding area now matches the app/terminal background; interior keeps input color.

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
