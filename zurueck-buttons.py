#!/usr/bin/env python3
"""Stellt alle "Zurück"-Links der Visu auf die neue Option "Zurück zur zuvor besuchten Seite" um.

Erkannt wird ein Link-Widget als Zurück-Link, wenn Beschriftung oder Widget-Name das Wort
"zurück"/"zurueck"/"back" enthält (nicht "Zurücksetzen", "Backofen" o. ä.). Das Icon allein
zählt nicht, damit z. B. ein "Rollo links" mit Pfeil-Icon unangetastet bleibt.

Danach hat jeder dieser Links:
  - history_back = an     (die bisherige Zielseite bleibt als Ausweichziel ohne Verlauf),
  - Icon "⬅" und Beschriftung "Zurück",
  - keinen kleinen "→"-Pfeil mehr.

Aufruf im OBS-Container (als root):
  python3 zurueck-buttons.py              # Vorschau: zeigt nur, was geändert würde
  python3 zurueck-buttons.py --apply      # ändert; legt vorher eine Sicherung an
  python3 zurueck-buttons.py --restore DATEI   # Sicherung wieder einspielen

Optionen: --url (Standard http://127.0.0.1:8080), --user (Standard admin), Passwort wird abgefragt.
Nur Standardbibliothek, kein Zusatzpaket nötig.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime

BACK_WORD = re.compile(r"(?<![a-zäöüß])(zur(ü|ue)ck|back)(?![a-zäöüß])", re.IGNORECASE)

NEW_ICON = "⬅"
NEW_LABEL = "Zurück"


def api(base: str, method: str, path: str, token: str | None = None, body: object | None = None) -> object:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{base}/api/v1{path}", data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:300]
        sys.exit(f"Fehler {exc.code} bei {method} {path}: {detail}")
    except urllib.error.URLError as exc:
        sys.exit(f"OBS unter {base} nicht erreichbar: {exc.reason}")
    return json.loads(raw) if raw else None


def login(base: str, user: str) -> str:
    password = os.environ.get("OBS_PASSWORD") or getpass.getpass(f"Passwort für {user}: ")
    return api(base, "POST", "/auth/login", body={"username": user, "password": password})["access_token"]


def is_back_link(widget: dict) -> bool:
    if widget.get("type") != "Link":
        return False
    cfg = widget.get("config") or {}
    texts = [str(cfg.get("label") or ""), str(widget.get("name") or "")]
    return any(BACK_WORD.search(t) for t in texts)


def already_done(cfg: dict) -> bool:
    return (
        cfg.get("history_back") is True
        and cfg.get("icon") == NEW_ICON
        and cfg.get("label") == NEW_LABEL
        and cfg.get("show_arrow") is False
        and cfg.get("show_icon", True) is not False
    )


def page_paths(tree: list[dict]) -> dict[str, str]:
    by_id = {n["id"]: n for n in tree}

    def path(node: dict) -> str:
        parts, seen = [], set()
        while node and node["id"] not in seen:
            seen.add(node["id"])
            parts.append(node["name"])
            node = by_id.get(node.get("parent_id"))
        return " / ".join(reversed(parts))

    return {n["id"]: path(n) for n in tree}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default="http://127.0.0.1:8080")
    parser.add_argument("--user", default="admin")
    parser.add_argument("--apply", action="store_true", help="Änderungen wirklich speichern")
    parser.add_argument("--restore", metavar="DATEI", help="Sicherung wieder einspielen")
    args = parser.parse_args()
    base = args.url.rstrip("/")
    token = login(base, args.user)

    if args.restore:
        with open(args.restore, encoding="utf-8") as fh:
            backup = json.load(fh)
        for page_id, entry in backup["pages"].items():
            api(base, "PUT", f"/visu/pages/{page_id}", token, entry["config"])
            print(f"wiederhergestellt: {entry['path']}")
        print(f"{len(backup['pages'])} Seite(n) aus {args.restore} wiederhergestellt.")
        return

    tree = api(base, "GET", "/visu/tree", token)
    paths = page_paths(tree)
    changes: dict[str, dict] = {}
    found = done = 0
    for node in tree:
        if node.get("type") != "PAGE":
            continue
        config = api(base, "GET", f"/visu/pages/{node['id']}", token)
        updated = json.loads(json.dumps(config))
        touched = False
        for widget in updated.get("widgets", []):
            if not is_back_link(widget):
                continue
            found += 1
            cfg = widget.setdefault("config", {})
            target = paths.get(cfg.get("target_node_id") or "", "— keine —")
            if already_done(cfg):
                done += 1
                continue
            name = f" (Widget-Name {widget.get('name')!r})" if widget.get("name") else ""
            print(f"  {paths[node['id']]}\n      vorher: {cfg.get('icon')!s:3} {cfg.get('label')!r}{name}  Ziel: {target}")
            cfg.update(history_back=True, icon=NEW_ICON, label=NEW_LABEL, show_arrow=False, show_icon=True)
            touched = True
        if touched:
            changes[node["id"]] = {"path": paths[node["id"]], "config": config, "updated": updated}

    print(f"\n{found} Zurück-Link(s) gefunden, {done} schon umgestellt, {len(changes)} Seite(n) zu ändern.")
    if not changes:
        return
    if not args.apply:
        print("Vorschau – nichts geändert. Zum Umstellen mit --apply erneut starten.")
        return

    backup_file = f"/root/zurueck-backup-{datetime.now():%Y%m%d-%H%M%S}.json"
    with open(backup_file, "w", encoding="utf-8") as fh:
        json.dump({"pages": {pid: {"path": c["path"], "config": c["config"]} for pid, c in changes.items()}}, fh, ensure_ascii=False, indent=1)
    print(f"Sicherung: {backup_file}")
    for page_id, change in changes.items():
        api(base, "PUT", f"/visu/pages/{page_id}", token, change["updated"])
    print(f"{len(changes)} Seite(n) gespeichert. Rückgängig: python3 {sys.argv[0]} --restore {backup_file}")


if __name__ == "__main__":
    main()
