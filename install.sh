#!/bin/bash
# Spielt das Paket "mein-stand" (offizieller open bridge server + eigene Erweiterungen)
# in einen OBS-LXC-Container ein. Vorher in Proxmox einen Snapshot anlegen!
set -euo pipefail

BASE_URL="https://github.com/strippe186/openbridgeserver/raw/mein-stand-paket"
PKG="obs-mein-stand.tar.gz"
INSTALL_DIR="/opt/obs"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [[ $EUID -ne 0 ]]; then echo "Bitte als root ausführen."; exit 1; fi
if [[ ! -x "$INSTALL_DIR/venv/bin/pip" ]]; then echo "$INSTALL_DIR/venv nicht gefunden – ist das ein OBS-LXC-Container?"; exit 1; fi

echo "==> Lade Paket ..."
curl -fsSL -o "$WORK/$PKG" "$BASE_URL/$PKG"
curl -fsSL -o "$WORK/$PKG.sha256" "$BASE_URL/$PKG.sha256"
curl -fsSL -o "$WORK/PAKET.txt" "$BASE_URL/PAKET.txt"
(cd "$WORK" && sha256sum -c "$PKG.sha256")
cat "$WORK/PAKET.txt"

echo "==> Stoppe OBS ..."
systemctl stop obs
echo "==> Entpacke nach $INSTALL_DIR ..."
tar -xzf "$WORK/$PKG" -C "$INSTALL_DIR"
echo "==> Python-Abhängigkeiten ..."
"$INSTALL_DIR/venv/bin/pip" install --no-cache-dir -q -r "$INSTALL_DIR/requirements.txt"
echo "==> Starte OBS ..."
systemctl start obs
echo "==> Fertig: $(cat "$INSTALL_DIR/obs/version"). Admin-GUI und Visu im Browser mit Strg+F5 neu laden."
