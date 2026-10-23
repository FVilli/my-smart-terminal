---
title: "Post-install onboarding"
type: guide
project: smart-terminal
created: 2026-10-23
---
<!-- gsynchro:v1 id=edcd86f6-08fa-4e17-acd6-b7965753115c registered=2026-10-23T11:00:07.867Z -->

# Post-install onboarding

This guide takes you from the first launch to a working local or SSH session. Shells and PTYs work without Git, AI, speech-to-text (STT), or a network connection.

> **Download status:** v1.0.0 is published at https://github.com/FVilli/my-smart-terminal/releases/latest. Verify `SHA256SUMS` before installing. Artifacts are unsigned and there is no auto-update.

## Launch the application

- **Linux AppImage**: run the AppImage directly (make it executable with `chmod +x` if needed).
- **Linux .deb**: open **Smart Terminal** from the applications menu, or run `"/opt/Smart Terminal/smart-terminal"`.
- **macOS**: open **Smart Terminal** from Applications; if Gatekeeper blocks the unsigned build, use the Finder Open context menu.
- **Windows**: launch **Smart Terminal** from the Start menu after running the installer.

## First launch: three onboarding steps

The first launch opens **Initial setup**. The wizard has three steps. You may skip the optional AI and STT steps; skipping them does not disable the terminal.

![Initial setup, step 1 of 3, with machine name, data repository, optional Git remote, Use defaults, and Next](assets/screenshots/01-onboarding.png)

*Initial setup shows the machine name and data repository fields, an optional Git remote, and the **Use defaults** and **Next** buttons.*

### 1. Data repository and machine

The first screen asks for:

- **Machine name** — the name used in session folders and filters. Use a short name without `/` and choose a different name on each computer.
- **Data repository (absolute path)** — where Smart Terminal keeps its `sessions/` Markdown data. Choose a local directory or an existing Git working tree.
- **Git remote (optional)** — the remote used for synchronization. Leave it empty if this installation has no remote yet.

Choose **Next** to save these values and continue. Choose **Use defaults** to use the local default repository; the terminal remains usable even when no remote is configured.

### 2. AI provider and token (optional)

The exact fields are **AI provider**, **Base URL (optional)**, **Model (optional)**, and **Token (optional, keychain only)**. Choose **none** to disable AI, or choose **anthropic**, **openai**, or **openai-compatible** for typo correction. Base URL and model let you customize a compatible endpoint; the token is stored in the operating system keychain (Electron `safeStorage`), never in Markdown or the synchronized repository.

Use **Skip** to continue without AI. AI correction is explicit and reviewable; it is not required for command entry. If the keychain is unavailable, the wizard shows **Keychain unavailable: the token will only be kept in memory.** Smart Terminal does not write a plaintext token. Configure a working keyring before expecting cloud AI to survive a restart.

### 3. STT and microphone (optional)

The exact fields are **STT provider**, **Model (optional)**, and, for cloud STT, **Token (optional, keychain only)**. Choose **none**, **local**, or **cloud**. A local provider additionally shows **Local STT command (absolute path)**; a cloud provider uses its keychain token. Select **Check microphone** and grant the operating system permission when prompted. The result may say **Microphone available. No recording is saved.**, **Microphone permission denied. You can continue without it.**, or **No microphone available. You can continue without it.** Use **Skip** to leave STT disabled; a denied or unavailable microphone does not affect terminal use.

Voice input is push-to-talk. Audio is held in memory while recording and is not saved as a recording. The transcription is placed in the editable draft and is never submitted automatically.

### Configuration and secrets

Non-secret settings are stored locally at `userData/config/config.md` (normally below the platform's application user-data directory). This file is **not synchronized**. The data repository contains session Markdown, not local configuration. AI/STT tokens are kept in the keychain and never in `config.md`, session files, history, or clipboard files. Do not put passwords, private keys, or other secrets in Markdown.

## Your first sessions

### Start a local session

After setup, the first tab is a local session. The tab label contains its session number, machine, and `local`. The terminal is a real PTY: type directly in it, or use the assisted editor at the bottom.

1. Type a harmless command such as `pwd` in the draft.
2. Press **Enter** to submit it. **Shift+Enter** inserts a newline instead.
3. Confirm that the command output appears in the terminal and the draft clears after successful submission.

Only successful assisted-editor submissions are recorded in history. Direct shell keystrokes and TUI prompts are not generally recorded.

![Two local tabs with independent terminal sessions and the assisted input bar](assets/screenshots/02-terminal-tabs.png)

*The terminal view shows two local tabs, a shell prompt, the assisted input bar, and the History/Clipboard sidebar.*

Each tab has its own PTY and draft. Switching tabs leaves the process running and keeps that tab's draft. Press **+** to open another tab and choose **Local** or an SSH alias.

### Start an SSH session

Smart Terminal reads aliases from `~/.ssh/config`, including supported `Include` entries and globs. It uses the system OpenSSH client and agent; it does not copy private keys.

1. Ensure the alias works outside the app: `ssh <alias>`.
2. Select **+**, then choose the alias under the SSH entries.
3. Authenticate using your normal SSH agent, key, or prompt.

![The new-tab menu with Local and SSH aliases prod-box and staging](assets/screenshots/03-ssh-menu.png)

*The new-tab menu shows **Local** and the SSH aliases **prod-box** and **staging**.*

An unreachable SSH host affects only that tab. Check the alias, network, host key, agent, and `~/.ssh/config`; other tabs continue to work.

## Clipboard capture and privacy

Clipboard capture is opt-in. In the **Clipboard** sidebar, select **Enable clipboard capture** to start collecting new clipboard values. Use **Pause** to stop collection temporarily; the button changes to **Resume**. **Clear dedupe** clears the in-memory duplicate tracking, not a promise that already synchronized Markdown is erased. Do not rely on the filter to protect secrets.

The sidebar can **Copy** an item or **Insert** it into the active draft. Insertion never sends the text automatically. Captured entries are associated with the active session and can be synchronized as Markdown. A best-effort filter ignores common keys, tokens, passwords, and credential-bearing URLs, but it cannot recognize every secret. Pause or disable capture before handling sensitive material, and never intentionally copy secrets into the repository.

![Clipboard sidebar with capture enabled and captured git status entries](assets/screenshots/06-clipboard.png)

*The Clipboard sidebar shows **Enable clipboard capture** checked, **Clipboard capture on**, **Pause**, **Clear dedupe**, and captured `git status` entries.*

## Git sync and the footer status

The footer shows the current sync state and the primary/secondary role. **Repository not configured** means that no Git remote is configured; local session files still work. Add a valid remote and branch in the local configuration, then restart or wait for status refresh.

- **synced** — the latest local changes are synchronized.
- **dirty** or **syncing** — local changes are waiting or being processed.
- **offline** — local commits can still be made; reconnect and let the scheduler fetch/rebase/push.
- **error** — inspect the error, preserve local files, and fix the remote, credentials, or conflict before retrying. Never force-push.

A missing remote is not an application failure. For a missing or wrong remote, configure it and verify with Git. For a rejected push or conflict, fetch/rebase or resolve the conflict with Git, keep the files, and retry. Sync is serialized by the primary window; a secondary window can still use the terminal.

![History sidebar with assisted submissions from two machines](assets/screenshots/05-history.png)

*The History sidebar shows two assisted submissions, `git pull --rebase` and `npm run build`, with machine and session labels.*

## AI correction and voice dictation

### Review AI corrections

Type a sentence containing a typo in the assisted draft and click the **AI** button. Smart Terminal corrects likely typos only. Text recognized as a shell command is skipped, and code, paths, URLs, flags, and meaning are preserved. Review the changed draft before pressing **Enter**: AI never executes or submits the result automatically. Provider errors or timeouts leave the terminal and original draft usable.

![AI correction review with an editable corrected draft](assets/screenshots/04-ai-review.png)

*The assisted draft contains “This is a sentence with a typo”, and the status says “AI correction applied: review before sending.”*

### Use voice dictation

Hold the microphone push-to-talk control. The UI reports **Voice ready**, **Listening…**, **Transcribing…**, or an error. Grant microphone permission in system settings if prompted. When transcription completes, the text is inserted into the editable draft; edit it and press **Enter** only when ready. No audio file is saved. Changing tabs or closing the window interrupts and discards the current audio.

## Troubleshooting

- **Microphone denied:** enable microphone permission for the application in system settings, restart if requested, or use the keyboard editor.
- **Keyring unavailable:** no plaintext fallback exists. A token may be usable in memory for the current Linux session, but it will not persist; install/configure a secure OS keyring.
- **SSH unreachable:** run `ssh <alias>`, check `~/.ssh/config`, network access, host keys, and the SSH agent. The app does not copy keys.
- **Git remote missing:** **Repository not configured** is expected until a remote and branch are set. Continue locally or configure the remote.
- **Git conflict or rejected push:** preserve local files, fetch/rebase and resolve the conflict, then retry. Force-push is never required.
- **Secondary/primary role:** **secondary** is normal when another window is the primary coordinator. Keep the working primary open; takeover occurs only when it stops responding.
- **AppImage will not start:** if FUSE is unavailable, run `./My-Smart-Terminal.AppImage --appimage-extract-and-run`.

## Setup checklist

- [ ] Choose a machine name and an absolute data repository path.
- [ ] Decide whether to configure a Git remote; verify the footer status.
- [ ] Optionally configure AI and confirm the token is in the keychain.
- [ ] Optionally configure STT, grant microphone permission, and test an editable result.
- [ ] Open a local tab and submit `pwd`.
- [ ] Open an SSH alias from `~/.ssh/config`, if needed.
- [ ] Confirm tabs retain their processes and drafts.
- [ ] Enable clipboard capture only if wanted; pause or clear it around sensitive work.
- [ ] Review an AI correction before sending; remember that shell commands are skipped.
