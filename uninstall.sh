#!/bin/sh
set -eu
fail() { printf '%s\n' "uninstall.sh: $*" >&2; exit 1; }
[ "$(id -u)" -ne 0 ] || fail 'Do not run this uninstaller as root; run it as your normal user.'
if command -v dpkg-query >/dev/null 2>&1; then
  STATUS=$(dpkg-query -W -f='${Status}' my-smart-terminal 2>/dev/null || :)
  if [ "$STATUS" = 'install ok installed' ]; then
    sudo apt-get remove -y my-smart-terminal </dev/null || fail 'Could not remove the my-smart-terminal package.'
  fi
fi
BIN_HOME=${XDG_BIN_HOME:-$HOME/.local/bin}
DATA_HOME=${XDG_DATA_HOME:-$HOME/.local/share}
rm -f "$BIN_HOME/smart-terminal" "$DATA_HOME/applications/smart-terminal.desktop" "$DATA_HOME/icons/hicolor/512x512/apps/smart-terminal.png"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DATA_HOME/applications" </dev/null || :
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f "$DATA_HOME/icons/hicolor" </dev/null || :
printf '%s\n' 'Smart Terminal removed. User data and external repositories were preserved.'
