---
title: "Linux installation guide"
type: guide
project: smart-terminal
created: 2026-10-23
---
<!-- gsynchro:v1 id=0c7cf147-e9f0-433e-8027-a48232215715 registered=2026-10-23T20:20:48.246Z -->

# Install Smart Terminal on Linux

Smart Terminal v1.3.9 supports 64-bit x86_64 Linux. The installer chooses the `.deb` package on Debian or Ubuntu and the AppImage on other distributions. You need an internet connection and a normal user account.

Release artifacts are unsigned. The installer verifies the SHA-256 checksum published with the release; this checks download integrity, but does not prove who built or signed the files. There are no automatic updates.

## Recommended: one-command install

The simplest method is:

```bash
curl -fsSL https://raw.githubusercontent.com/FVilli/my-smart-terminal/v1.3.9/install.sh | sh
```

This downloads the v1.3.9 release, verifies the SHA-256 checksum of the downloaded artifact, and installs it. On Debian or Ubuntu, it uses `sudo` only when `apt-get` installs the `.deb` package. On other distributions, it installs a per-user AppImage in `~/.local/bin` and creates a per-user XDG applications-menu entry and icon. The icon uses the new Smart Terminal branding.

This command downloads and immediately executes a remote script. Run it only if you trust the repository and its release process. To inspect the script first, use:

```bash
curl -fsSL https://raw.githubusercontent.com/FVilli/my-smart-terminal/v1.3.9/install.sh -o /tmp/smart-terminal-install.sh
less /tmp/smart-terminal-install.sh
sh /tmp/smart-terminal-install.sh
```

The script refuses to run as root and supports Linux x86_64 only.

### Choose the package type

Auto mode is the default: it chooses `.deb` on Debian or Ubuntu, and AppImage otherwise. You can choose explicitly:

```bash
curl -fsSL https://raw.githubusercontent.com/FVilli/my-smart-terminal/v1.3.9/install.sh | sh -s -- --deb
curl -fsSL https://raw.githubusercontent.com/FVilli/my-smart-terminal/v1.3.9/install.sh | sh -s -- --appimage
```

`--deb` requires Debian or Ubuntu with `apt-get` and `dpkg`. `--appimage` is for x86_64 Linux and installs the AppImage for your user. Do not use `--appimage` while the `my-smart-terminal` `.deb` package is installed.

## Menu entry and icon

The `.deb` package automatically creates the **Smart Terminal** applications-menu entry and installs its icon on Ubuntu and Debian.

The AppImage branch creates a per-user XDG `.desktop` entry under your user data directory and installs the icon there. The entry may not appear until you log out and back in. The AppImage executable is installed as `~/.local/bin/smart-terminal`; your desktop environment may need `~/.local/bin` on your `PATH` for terminal launches. Both installation paths use the new Smart Terminal branding.

After installation, start the app from the applications menu. For the AppImage, you can also run:

```bash
"$HOME/.local/bin/smart-terminal"
```

## Remove Smart Terminal

Run the version-independent uninstaller as your normal user:

```bash
curl -fsSL https://raw.githubusercontent.com/FVilli/my-smart-terminal/main/uninstall.sh -o /tmp/smart-terminal-uninstall.sh
sh /tmp/smart-terminal-uninstall.sh
```

The uninstaller tracks the installed application and is not pinned to an application release. A tagged uninstaller URL may be used only as an explicitly labelled reproducibility fallback; it is not the normal removal command.

This removes the installed package when a `.deb` is present, or removes the script-installed per-user AppImage, menu entry, and icon. It preserves `~/.config/my-smart-terminal`, your sessions, and any external data repositories.

This also executes a remote script. Inspect it first if you prefer:

```bash
curl -fsSL https://raw.githubusercontent.com/FVilli/my-smart-terminal/main/uninstall.sh -o /tmp/smart-terminal-uninstall.sh
less /tmp/smart-terminal-uninstall.sh
sh /tmp/smart-terminal-uninstall.sh
```

If the uninstaller is unavailable and you installed the `.deb`, the manual fallback is:

```bash
sudo apt remove -y my-smart-terminal
```

This fallback does not remove your user data. For an AppImage installed by other means, remove that AppImage and its desktop entry and icon manually.

## Update

There is no automatic updater. After a newer release is published, rerun the install command with the newer release tag in the raw URL. The `.deb` is installed again, or the AppImage replaces the script-installed copy. Configuration, sessions, and external repositories are preserved.

## Manual fallback for troubleshooting

If the script cannot run, use the [Smart Terminal v1.3.9 release page](https://github.com/FVilli/my-smart-terminal/releases/tag/v1.3.9). Download the matching x86_64 `.deb` and `SHA256SUMS`, verify the package's SHA-256 checksum, then install it on Debian or Ubuntu:

```bash
grep -F "  Smart.Terminal-1.3.9-linux-amd64.deb" SHA256SUMS > expected.sha256
sha256sum -c expected.sha256
sudo apt install -y ./Smart.Terminal-1.3.9-linux-amd64.deb
```

For another distribution, download the matching x86_64 AppImage, verify it with `SHA256SUMS`, make it executable with `chmod +x`, and run it. This manual path does not create the script's per-user menu entry and icon automatically.

## Where your data is kept

| Location | What it contains | What removal does |
| --- | --- | --- |
| Installed `.deb` or AppImage file | Application files. | Package removal or the uninstaller removes application files; it does not remove user data. |
| `~/.config/my-smart-terminal` (or `$XDG_CONFIG_HOME/my-smart-terminal`) | Local configuration, secrets, installation and coordinator information, and the default data repository in its `data/` subfolder. | The installer and uninstaller preserve this folder. Removing it can delete local settings and sessions. |
| External data repository, if selected | Session and other repository data at the location you chose. | Separate from the application; installation and removal do not remove it. |

The default repository inside the user-data folder may contain sessions. An external repository is separate and is not affected by uninstalling the application.

### Optional local-data cleanup

Only do this if you want to remove local settings and, if present, the default data repository. Back up anything you may need first and close Smart Terminal. Renaming keeps a backup instead of deleting the folder:

```bash
mv "$HOME/.config/my-smart-terminal" "$HOME/.config/my-smart-terminal-backup"
```

If you use a custom `XDG_CONFIG_HOME`, the folder is under that location instead of `$HOME/.config`. Never remove an external repository unless you have separately backed it up and are sure you no longer need it.

## Troubleshooting

- **No applications-menu entry:** for the `.deb`, confirm installation completed. For the AppImage, log out and back in to refresh the menu; also check the per-user XDG applications directory and `~/.local/share/icons`.
- **Permission denied when running an AppImage:** the script normally sets the installed file executable. For the manually downloaded v1.3.9 artifact, run `chmod +x ./Smart.Terminal-1.3.9-linux-x86_64.AppImage` from the directory containing that file.
- **`apt` reports dependency errors:** run `sudo apt install -y ./Smart.Terminal-1.3.9-linux-amd64.deb` from the folder containing the downloaded package so `apt` can resolve dependencies.
- **FUSE or AppImage sandbox error:** try `"$HOME/.local/bin/smart-terminal" --appimage-extract-and-run` for the script-installed AppImage, or add `--appimage-extract-and-run` to the manually downloaded file command. Do not disable system security settings to work around it.
- **Checksum mismatch:** do not install or run the file. Delete the download, try again from the [Smart Terminal v1.3.9 release page](https://github.com/FVilli/my-smart-terminal/releases/tag/v1.3.9), and verify again. If it still fails, do not use that download.
- **Missing data or settings:** check whether you selected an external data repository during setup. The default data is under `~/.config/my-smart-terminal/data`; external data is at the path you chose.
- **Remote-script caution:** `curl | sh` runs code received from the network and the artifacts are not signed. Inspect the script first if that trust decision is not acceptable.

**Other platforms:** [Windows installation guide](20%20-%20Windows%20installation%20guide.md) · [macOS installation guide](22%20-%20macOS%20installation%20guide.md)
