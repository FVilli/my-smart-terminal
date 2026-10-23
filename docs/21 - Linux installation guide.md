---
title: "Linux installation guide"
type: guide
project: smart-terminal
created: 2026-10-23
---

# Install Smart Terminal on Linux

Smart Terminal v1.1.0 is available for 64-bit x86_64 Linux. Ubuntu and Debian users should use the `.deb` package. Users of other Linux distributions can try the AppImage. Downloading requires an internet connection; you do not need root access to run the app. The `.deb` install command asks for administrator access only to install the package.

The release assets are unsigned. These commands check that each downloaded file matches the SHA-256 checksum published alongside it; this checks download integrity, but does not prove who built or signed the files. Smart Terminal has no automatic updates.

## Recommended: Ubuntu or Debian `.deb`

Copy and paste this block into a terminal. When a newer release is available, replace `VERSION` with that release version and use its matching asset names.

```bash
set -euo pipefail
# Replace VERSION when a newer release exists.
VERSION="1.1.0"
BASE="https://github.com/FVilli/my-smart-terminal/releases/download/v${VERSION}"
DEB="Smart.Terminal-${VERSION}-linux-amd64.deb"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"

curl -fL -o "$DEB" "$BASE/$DEB"
curl -fL -o SHA256SUMS "$BASE/SHA256SUMS"
# The checksum validates download integrity; release artifacts are unsigned.
if ! grep -F "  $DEB" SHA256SUMS > expected.sha256; then
  echo "Could not find checksum for $DEB in SHA256SUMS" >&2
  exit 1
fi
sha256sum -c expected.sha256
sudo apt install -y "./$DEB"
```

`apt` installs the package's declared dependencies. Do not run the whole block as root; only the package installation uses `sudo`.

## Other distributions: AppImage

The AppImage is for x86_64. This downloads and checks it, keeps it in `~/Applications`, and runs it without installing it. Change `VERSION` and the filename together for a newer release.

```bash
set -euo pipefail
VERSION="1.1.0"
BASE="https://github.com/FVilli/my-smart-terminal/releases/download/v${VERSION}"
APPIMAGE="Smart.Terminal-${VERSION}-linux-x86_64.AppImage"
DEST="$HOME/Applications"
mkdir -p "$DEST"
cd "$DEST"

curl -fL -o "$APPIMAGE" "$BASE/$APPIMAGE"
curl -fL -o SHA256SUMS "$BASE/SHA256SUMS"
if ! grep -F "  $APPIMAGE" SHA256SUMS > expected.sha256; then
  echo "Could not find checksum for $APPIMAGE in SHA256SUMS" >&2
  exit 1
fi
sha256sum -c expected.sha256
chmod +x "$APPIMAGE"
"./$APPIMAGE"
```

If the AppImage cannot start because FUSE is unavailable, use this command instead of the final run command above:

```bash
"$HOME/Applications/Smart.Terminal-1.1.0-linux-x86_64.AppImage" --appimage-extract-and-run
```

FUSE requirements vary by distribution; consult your distribution's guidance rather than installing a package name intended for a different system. The AppImage needs no installation and stays in `~/Applications` so you can run it again. It uses the same local user data as the `.deb` version.

## Launch and first run

After installing the `.deb`, open **Smart Terminal** from your applications menu, or run:

```bash
"/opt/Smart Terminal/smart-terminal"
```

The AppImage can be launched by opening the file in your file manager or running it from a terminal. On first launch, the setup links explain choosing a data repository and machine name, and optional AI and speech settings. See the [post-install onboarding guide](14%20-%20Post-install%20onboarding.md) for details.

## Update

There is no automatic updater. For a newer `.deb`, repeat the download, checksum, and install steps above with its version and matching filename. Installing a newer version preserves your local settings and data. For an AppImage, download and checksum the newer file, then replace your old AppImage; your local data is still kept separately.

## Uninstall

To remove the `.deb` package, run:

```bash
sudo apt remove -y smart-terminal
```

This removes the installed application. `apt remove` and `apt purge` do not remove Smart Terminal's user data. Do not use purge expecting it to erase local settings or sessions.

For an AppImage, close Smart Terminal, then delete the AppImage file and any `.desktop` shortcut you created yourself.

## Where your data is kept

| Location | What it contains | What removal does |
| --- | --- | --- |
| Installed app (`.deb`) or AppImage file | The application files. | Package removal removes the `.deb` application; deleting an AppImage removes that file. |
| `~/.config/my-smart-terminal` (or `$XDG_CONFIG_HOME/my-smart-terminal`) | Local configuration, secrets, installation and coordinator information, and the default data repository in its `data/` subfolder. | App uninstall does not remove this folder. Removing it can delete local settings and sessions. |
| External data repository, if selected | Session and other repository data at the location you chose. | Separate from the application and user-data folder; uninstall does not remove it. |

The app may be using an external repository you selected during setup. That repository is separate and is not affected by the optional cleanup below. The default repository inside the user-data folder may contain sessions.

### Optional local-data cleanup

Only do this if you want to remove local settings and, if present, the default data repository. Back up anything you may need first and close Smart Terminal. Renaming keeps a backup instead of deleting the folder:

```bash
mv "$HOME/.config/my-smart-terminal" "$HOME/.config/my-smart-terminal-backup"
```

If you use a custom `XDG_CONFIG_HOME`, the folder is under that location instead of `$HOME/.config`. Do not run cleanup while the app is open. Never remove an external repository unless you have separately backed it up and are sure you no longer need it.

## Troubleshooting

- **Permission denied when running the AppImage:** make it executable with `chmod +x "./Smart.Terminal-1.1.0-linux-x86_64.AppImage"`, then run it again.
- **`apt` reports dependency errors:** use `sudo apt install -y "./Smart.Terminal-1.1.0-linux-amd64.deb"` from the folder containing the downloaded package. This lets `apt` resolve declared dependencies. Check your network and supported distribution if it still fails.
- **FUSE or AppImage sandbox error:** try the `--appimage-extract-and-run` command above. Do not disable system security settings to work around it.
- **No applications-menu entry:** confirm the `.deb` install completed, then try `"/opt/Smart Terminal/smart-terminal"` in a terminal. You can also log out and back in to refresh the menu.
- **Missing data or settings:** check whether you selected an external data repository in setup. The default data is under `~/.config/my-smart-terminal/data`; external data is at the path you chose.
- **Checksum mismatch:** do not install or run the file. Delete the download, try again from the [latest release page](https://github.com/FVilli/my-smart-terminal/releases/latest), and verify again. If it still fails, do not use that download.
