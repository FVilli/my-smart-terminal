---
title: "Windows installation guide"
type: guide
project: smart-terminal
created: 2026-10-23
---
<!-- gsynchro:v1 id=be66ebc4-7a2e-461f-9d47-863272cd98a9 registered=2026-10-23T13:30:10.303Z -->

# Windows installation guide

This guide is for people installing Smart Terminal on a Windows PC, including people who do not usually install software manually.

## What you need

- Windows 10 or Windows 11, 64-bit (x64). The current Windows installer is for x64 only.
- An internet connection to download the installer.
- You do not need administrator permission: the installer installs for your Windows user.

The v1.1.0 installer is `Smart.Terminal-1.1.0-win-x64.exe`. It is unsigned, so Windows SmartScreen may show a warning. Smart Terminal has no automatic updater.

## Download and verify (optional)

Download the installer from the [latest Smart Terminal release](https://github.com/FVilli/my-smart-terminal/releases/latest). On the release page, download `Smart.Terminal-1.1.0-win-x64.exe`. To check its integrity, also download `SHA256SUMS` from that same release and save both files in your Downloads folder.

You can compare the installer with the published checksum using PowerShell. This block downloads both files from the same release and stops with a clear error if the expected checksum is missing or does not match:

```powershell
$ErrorActionPreference = 'Stop'
$release = 'https://github.com/FVilli/my-smart-terminal/releases/download/v1.1.0'
$folder = Join-Path $HOME 'Downloads'
$installer = Join-Path $folder 'Smart.Terminal-1.1.0-win-x64.exe'
$checksums = Join-Path $folder 'SHA256SUMS'

Invoke-WebRequest "$release/Smart.Terminal-1.1.0-win-x64.exe" -OutFile $installer
Invoke-WebRequest "$release/SHA256SUMS" -OutFile $checksums

$line = Get-Content $checksums | Where-Object { $_ -match '(^|\s)Smart\.Terminal-1\.1\.0-win-x64\.exe$' } | Select-Object -First 1
if (-not $line -or $line -notmatch '^\s*([0-9a-fA-F]{64})\s+\*?Smart\.Terminal-1\.1\.0-win-x64\.exe$') {
    throw 'Could not find a valid installer checksum in SHA256SUMS.'
}
$expected = $Matches[1].ToLowerInvariant()
$actual = (Get-FileHash -Algorithm SHA256 $installer).Hash.ToLowerInvariant()
if ($actual -ne $expected) {
    throw "Checksum mismatch. Do not run the installer. Expected $expected but got $actual."
}
'Checksum verified.'
```

A checksum match verifies that the file matches the checksum file you downloaded; it does not mean the installer is code-signed.

## Install and start

1. Double-click `Smart.Terminal-1.1.0-win-x64.exe` in Downloads.
2. Follow the setup wizard. It installs for your Windows user, does not require administrator permission, and lets you change the installation folder. A desktop shortcut is offered/created.
3. If SmartScreen warns that the app is unrecognized, continue only after you have checked that the installer came from the release page above and, if using the optional check, its checksum matches. Then choose **More info** and **Run anyway**. If you cannot verify the source, cancel the warning. Do not disable SmartScreen or other security protections.
4. Start **Smart Terminal** from the Start menu or desktop shortcut.

On first launch, setup asks for a data repository location and machine name; AI and voice setup are optional. See the [post-install onboarding guide](14%20-%20Post-install%20onboarding.md), [repository setup guide](18%20-%20Repository%20setup%20guide.md), and [user manual](12%20-%20User%20manual.md). You can use the terminal without configuring AI, voice, Git, or a network connection after installation.

## Where the app and your data live

The default program folder is `%LOCALAPPDATA%\Programs\Smart Terminal`. The installer can use a different folder. Your local application settings and supporting files are separate, in `%APPDATA%\my-smart-terminal`; this folder includes configuration, secrets storage metadata, installation information, and coordinator files. Do not confuse it with the data repository.

By default, the data repository is `%APPDATA%\my-smart-terminal\data`. During setup you can instead choose another folder, such as an existing Git working folder. Session Markdown lives in that repository. If you chose an external repository, removing the default folder will not remove that external data.

## Update

There is no automatic update. To update, download and run the newer Windows installer from the release page and install it over the existing installation. Your settings and session data are stored separately from the program and are preserved. Back up important data before making major changes.

## Remove the app or remove data?

| Action | What it removes | What it keeps |
| --- | --- | --- |
| Uninstall Smart Terminal | The application files and shortcuts | `%APPDATA%\my-smart-terminal` and your data repository |
| Remove local app data (optional, manual) | `%APPDATA%\my-smart-terminal`, including local configuration and default data under `data` | The installed app, unless you also uninstall it; any external data repository |
| Remove an external data repository (optional, manual) | Only the external folder you selected | The app and its local settings |

Uninstalling the app does **not** delete user data. Removing `%APPDATA%\my-smart-terminal` deletes local settings and, if still stored there, your sessions. Back up anything you need first. If you are unsure, rename the folder (for example, to `my-smart-terminal-backup`) instead of deleting it; leave it in place until you have confirmed that you no longer need its contents. An external repository is independent and must be handled separately.

To uninstall the app, open **Settings > Apps** (or **Apps & features** on some Windows versions), find **Smart Terminal**, and choose **Uninstall**. You can also use **Uninstall Smart Terminal** from the Start menu. The uninstaller is also in the application folder as `Uninstall Smart Terminal.exe`. Uninstalling does not automatically remove the data folders above.

## Troubleshooting and recovery

- **SmartScreen appears:** confirm the release-page source and checksum first. Only then use **More info > Run anyway** if you choose to proceed. Otherwise cancel; never turn off SmartScreen.
- **Installer will not open:** confirm Windows is 64-bit and the download completed. Download a fresh copy from the release page and optionally verify it again.
- **No desktop icon:** search for **Smart Terminal** in the Start menu.
- **Settings or sessions seem missing:** check the correct Windows account and whether setup selected an external repository. The default local data folder is `%APPDATA%\my-smart-terminal`; the default repository is its `data` subfolder.
- **Need to recover after deleting or changing folders:** stop the app and restore your backup. If you renamed the folder, restore its original name when the app is closed. Do not delete or move files while Smart Terminal is running.
- **Still need help:** consult the [user manual](12%20-%20User%20manual.md) and [post-install onboarding guide](14%20-%20Post-install%20onboarding.md). Keep a backup of the data repository before attempting recovery.

**Other platforms:** [Linux installation guide](21%20-%20Linux%20installation%20guide.md) · [macOS installation guide](22%20-%20macOS%20installation%20guide.md)
