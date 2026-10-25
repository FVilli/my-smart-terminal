---
title: Build and release
project: smart-terminal
type: operations
version: 1
created: 2026-10-22
---
<!-- gsynchro:v1 id=e2904c0a-e3a9-4faf-bf84-72c71b93bdb9 registered=2026-10-23T07:57:49.384Z -->
# Build and release

## Distribution
First release through a manual channel (downloadable artifacts); no auto-update in V1. Produce packages for Linux (AppImage and .deb), Windows (.exe installer), and macOS (.dmg). Use `electron-builder` in the desktop package; SemVer versioning and `vX.Y.Z` tags. GitHub Releases is for the **code repository**; the session repository is separate.

## CI
GitHub Actions, Linux/macOS/Windows matrix: reproducible lockfile installation, lint + typecheck, unit tests, Angular/Electron build, PTY tests, and packaging smoke tests. Run multi-instance/Git integration tests in an isolated environment without real tokens. No push/release from untrusted pull requests. On Linux, Electron smoke tests run on Xvfb (`scripts/run-electron.mjs`, display `:99`) and not on the runner desktop; install `xvfb` in the pipeline or use the local binary documented in `docs/11`.

## Release security
Publish SHA-256 checksums with the release artifacts. Sign macOS/Windows only when certificates are available; otherwise clearly state that artifacts are unsigned (never claim that an unsigned package is signed). Protect CI secrets. Rebuild native `node-pty` dependencies for Electron and the target OS/architecture.

## Fast local Linux testing

For iterative testing do not wait for GitHub Actions:

```bash
npm run package:deb
sudo apt install --reinstall ./release/Smart.Terminal-1.3.17-linux-amd64.deb
```

For UI-only iterations, `npm run package:dir` and run `release/linux-unpacked/smart-terminal`; for renderer hot reload use `npm run dev`. GitHub Actions is only for publishing/CI, not required for local feedback.

## Release gate
1. Tests and packaging pass on the declared platforms.
2. Verify offline terminal, multiple windows, primary election, lock recovery, Git sync with concurrency, and push rejection.
3. No credentials in Markdown or build logs.
4. Compare the UI with the approved mockup, including monospace and the 75/25 layout.
5. Release notes: features, limitations, data migration, and installation instructions.

## v1.3.17 implementation
- Version `1.3.17` in root/desktop/renderer; `electron-builder` in `electron-builder.yml` with:
  - Linux: AppImage and `.deb` (`npm run package:linux`), icon `apps/desktop/build/icon-linux.png`, `executableName smart-terminal`, `syncDesktopName`.
  - macOS: `.dmg`; Windows: NSIS installer. Built by the respective native pipelines (the local Linux build produces Linux artifacts only).
  - `asar: true`, `node-pty` in `asarUnpack`, native rebuild for Electron, `artifactName` with name/version/os/arch.
- `npm run package:dir` for a quick check; `npm run checksums` generates `release/SHA256SUMS` excluding update metadata.
- CI: `.github/workflows/ci.yml` (Linux/macOS/Windows matrix, `npm ci`, lint, typecheck, test, coordinator, build, native rebuild, Linux smoke on Xvfb, package, checksums, artifact upload). `.github/workflows/release.yml` on `v*` tags publishes artifacts and `SHA256SUMS` with `GITHUB_TOKEN`; no release from PRs.
- Linux smoke artifact verified with AppImage `--appimage-extract-and-run` and `SMART_TERMINAL_SMOKE=1` on a virtual display.
- V1 artifacts are **unsigned**; no auto-update. Always publish `SHA256SUMS` and the unsigned notice. App version is `1.3.17`, expected tag `v1.3.17`.

## Updates and compatibility
The Markdown frontmatter schema has a `schema_version` field; a new app version must read previous schemas or perform explicit migrations with backup. Do not destructively modify synchronized content during automatic upgrades.
