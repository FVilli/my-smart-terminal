---
title: "macOS installation guide"
type: guide
project: smart-terminal
created: 2026-10-23
---
<!-- gsynchro:v1 id=97b440ef-4705-4c18-8ef8-0284667d78b3 registered=2026-10-23T20:20:48.249Z -->

# Install Smart Terminal on macOS

This guide covers downloading, installing, updating, and removing Smart Terminal. The current release is unsigned and not notarized, so macOS may show a security warning the first time you open it.

## Requirements

- An Apple Silicon Mac (M-series). The current release is 64-bit arm64 only. Intel Macs are not supported; Rosetta cannot make this arm64-only app run on an Intel Mac.
- A practical supported macOS version is a recent, maintained macOS release. The current package does not specify a minimum macOS version; compatibility with older releases is not guaranteed.
- An internet connection to download the app.

The macOS download for v1.3.0 is `Smart.Terminal-1.3.0-mac-arm64.dmg`. Find it on the [Smart Terminal v1.3.0 release page](https://github.com/FVilli/my-smart-terminal/releases/tag/v1.3.0), along with `SHA256SUMS`.

## Download, verify, and open the disk image

Open **Terminal.app**, paste the following helper, and press Return. It downloads the disk image and checksum list, verifies the checksum for that disk image only, and opens the verified DMG. It does not install or copy the app. It does not use administrator access or change macOS security settings.

```bash
set -euo pipefail
VERSION="1.3.0"
BASE="https://github.com/FVilli/my-smart-terminal/releases/download/v${VERSION}"
DMG="Smart.Terminal-${VERSION}-mac-arm64.dmg"
DEST="$HOME/Downloads"

mkdir -p "$DEST"
cd "$DEST"
curl -fL "$BASE/$DMG" -o "$DMG"
curl -fL "$BASE/SHA256SUMS" -o SHA256SUMS
grep -F "  $DMG" SHA256SUMS | awk 'NR == 1 { print; found = 1 } END { if (!found) exit 1 }' > expected.sha256
shasum -a 256 -c expected.sha256
open "$DMG"
```

For a future release, replace `VERSION` with its release version and confirm the exact DMG filename on that tagged release page. A matching checksum shows that the downloaded file matches the published checksum list; it does not prove that the app is signed or notarized.

## Install

1. In the disk image window that opens, drag **Smart Terminal.app** to **Applications**.
2. Wait for copying to finish, then eject the mounted Smart Terminal disk image in Finder.
3. Open **Applications** and launch **Smart Terminal**.

## First launch security warning

Try opening the app normally first. Because this release is unsigned and not notarized, Gatekeeper may block it. If macOS blocks the first launch:

- Open **System Settings > Privacy & Security**. Scroll to the **Security** section, choose **Open Anyway** for Smart Terminal, authenticate, then confirm **Open** when the warning appears. This saves the app as an exception so you can open it normally later.
- On older macOS versions, Finder's right-click (or Control-click) **Open** may also offer this choice.

Do not disable Gatekeeper or remove quarantine attributes. If macOS says the app is damaged, stop and do not bypass the warning: verify the checksum, delete the download, and download it once more from the v1.3.0 release page. If the message persists after a verified re-download, report it on the project issue tracker instead of weakening macOS security.

## Update

There is no automatic updater. Download the newer DMG from the [release page](https://github.com/FVilli/my-smart-terminal/releases/tag/v1.3.0), verify it, open it, then drag **Smart Terminal.app** into Applications and confirm that you want to replace the existing app. Your data is stored separately and is not removed by replacing the app.

## Uninstall

1. Quit Smart Terminal with **Command-Q**.
2. Open Applications and drag **Smart Terminal.app** to the Trash.
3. Empty the Trash if you want to finish removing the app.

If you are running the app directly from a mounted disk image, quit it, eject the disk image, and remove the downloaded DMG if you no longer need it. Removing the app does not remove its data folder or any external data repository.

## Where your data lives

| Item | Location | What happens when you remove the app? |
| --- | --- | --- |
| App bundle | `/Applications/Smart Terminal.app` | Removed when you drag it to the Trash. |
| App settings and default data repository | `~/Library/Application Support/my-smart-terminal` (default repository is its `data/` subfolder) | Remains on your Mac. The default `data/` folder may contain sessions. |
| External repository | The location you chose during setup | Separate from the app and its support folder; remains where you put it. |

Smart Terminal may store configuration and other app data in its Application Support folder. This guide does not assume a single cache or log location.

### Optional data cleanup

Only do this if you are sure you no longer need the settings or session files:

1. Quit Smart Terminal.
2. Back up the folder first if you may need anything in it. The default `data/` subfolder may contain your sessions.
3. In Finder, use **Go > Go to Folder…**, enter `~/Library/Application Support/`, and find `my-smart-terminal`.
4. Instead of deleting it immediately, rename it to `my-smart-terminal-backup`. You can remove the backup later after confirming you do not need it.

An external repository is separate. Find and back it up or remove it separately; do not assume that uninstalling the app affects it.

## Troubleshooting

- **“Unidentified developer” or macOS cannot open the app:** Open System Settings > Privacy & Security, scroll to Security, click **Open Anyway**, authenticate, then confirm Open. On older macOS versions, Finder right-click **Open** may also work. Do not disable Gatekeeper.
- **macOS says the app is damaged:** Do not bypass the warning. Check that the checksum matches, delete the download, and download it once more from the v1.3.0 release page. If it persists after a verified re-download, report the issue; do not remove quarantine attributes.
- **No permission to copy into Applications:** Use your personal Applications folder if available, or ask the Mac administrator for permission. Do not use `sudo` to install the app.
- **Wrong architecture:** This release is arm64 for Apple Silicon only. Intel Macs are unsupported; obtain a compatible future release rather than trying Rosetta.
- **Data seems missing:** Check the repository location selected during setup. The default is `~/Library/Application Support/my-smart-terminal/data`; a selected external repository is stored elsewhere. Do not remove or rename data until you have checked both locations.
- **Gatekeeper warns again:** Use the approved Privacy & Security **Open Anyway** path (or Finder **Open** on older macOS versions). Do not turn off Gatekeeper or strip quarantine attributes.

For first-run steps, see the [post-install onboarding guide](14%20-%20Post-install%20onboarding.md). For sessions and application features, see the [user manual](12%20-%20User%20manual.md). To understand or change your data repository, see the [repository setup guide](18%20-%20Repository%20setup%20guide.md).

**Other platforms:** [Windows installation guide](20%20-%20Windows%20installation%20guide.md) · [Linux installation guide](21%20-%20Linux%20installation%20guide.md)
