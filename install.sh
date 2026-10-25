#!/bin/sh
set -eu

fail() { printf '%s\n' "install.sh: $*" >&2; exit 1; }
[ "$(id -u)" -ne 0 ] || fail 'Do not run this installer as root; run it as your normal user.'
[ "$(uname -s)" = Linux ] || fail 'This installer supports Linux only.'
case "$(uname -m)" in x86_64|amd64) ;; *) fail 'This installer requires Linux x86_64.' ;; esac
command -v curl >/dev/null 2>&1 || fail 'curl is required.'

VERSION=1.4.0
BASE="https://github.com/FVilli/my-smart-terminal/releases/download/v${VERSION}"
MODE=auto
while [ "$#" -gt 0 ]; do
  case "$1" in
    --help) printf '%s\n' 'Usage: install.sh [--deb|--appimage]'; exit 0 ;;
    --deb) MODE=deb ;;
    --appimage) MODE=appimage ;;
    *) fail "Unknown option: $1" ;;
  esac
  shift
done

TMP=$(mktemp -d) || fail 'Could not create a temporary directory.'
trap 'rm -rf "$TMP"' EXIT HUP INT TERM
fetch() { curl -fsSL --retry 3 --connect-timeout 15 -o "$2" "$1" </dev/null; }
verify() {
  FILE=$1
  fetch "$BASE/SHA256SUMS" "$TMP/SHA256SUMS"
  (cd "$TMP" && awk -v name="$FILE" 'length($1) == 64 && $2 == name && $0 ~ /^[0-9a-fA-F]+  / { print; count++ } END { if (count != 1) exit 1 }' SHA256SUMS > expected && sha256sum -c expected) || fail "Checksum verification failed for $FILE."
}
DEB="Smart.Terminal-${VERSION}-linux-amd64.deb"
APP="Smart.Terminal-${VERSION}-linux-x86_64.AppImage"
IS_DEBIAN=false
if [ -f /etc/debian_version ] && command -v apt-get >/dev/null 2>&1 && command -v dpkg >/dev/null 2>&1; then IS_DEBIAN=true; fi
if [ "$MODE" = deb ] && [ "$IS_DEBIAN" != true ]; then fail '--deb requires a Debian or Ubuntu system with apt-get and dpkg.'; fi
if [ "$MODE" = deb ] || { [ "$MODE" = auto ] && [ "$IS_DEBIAN" = true ]; }; then
  fetch "$BASE/$DEB" "$TMP/$DEB"
  verify "$DEB"
  sudo apt-get install -y "$TMP/$DEB" </dev/null
  [ -f /usr/share/applications/smart-terminal.desktop ] || printf '%s\n' 'Warning: installed desktop entry was not found under /usr/share/applications.' >&2
  [ -f /usr/share/icons/hicolor/512x512/apps/smart-terminal.png ] || printf '%s\n' 'Warning: installed icon was not found under /usr/share/icons.' >&2
  printf '%s\n' 'Smart Terminal installed. Find it in your applications menu.'
  exit 0
fi
if command -v dpkg-query >/dev/null 2>&1; then
  STATUS=$(dpkg-query -W -f='${Status}' my-smart-terminal 2>/dev/null || :)
  [ "$STATUS" != 'install ok installed' ] || fail 'The my-smart-terminal .deb is already installed. Remove it before installing the AppImage, or use --deb to upgrade the package.'
fi
fetch "$BASE/$APP" "$TMP/$APP"
verify "$APP"
BIN_HOME=${XDG_BIN_HOME:-$HOME/.local/bin}
DATA_HOME=${XDG_DATA_HOME:-$HOME/.local/share}
mkdir -p "$BIN_HOME" "$DATA_HOME/icons/hicolor/512x512/apps" "$DATA_HOME/applications"
cp "$TMP/$APP" "$BIN_HOME/smart-terminal"
chmod 755 "$BIN_HOME/smart-terminal"
fetch "https://raw.githubusercontent.com/FVilli/my-smart-terminal/v${VERSION}/docs/assets/icon.png" "$DATA_HOME/icons/hicolor/512x512/apps/smart-terminal.png"
DESKTOP="$DATA_HOME/applications/smart-terminal.desktop"
printf '[Desktop Entry]\nVersion=1.0\nName=Smart Terminal\nComment=Multi-session terminal with Markdown history and Git sync\nExec="%s"\nIcon=smart-terminal\nTerminal=false\nType=Application\nCategories=Development;\nStartupWMClass=smart-terminal\n' "$BIN_HOME/smart-terminal" > "$DESKTOP"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DATA_HOME/applications" </dev/null || :
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f "$DATA_HOME/icons/hicolor" </dev/null || :
printf '%s\n' 'Smart Terminal installed. Find it in your applications menu.'
