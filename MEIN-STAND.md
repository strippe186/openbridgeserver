# Mein Stand — eigene Erweiterungen für open bridge server

Dieser Branch (`mein-stand`) ist **nur für meine eigene Installation** gedacht und wird nicht
als Pull Request eingereicht. Er besteht aus dem offiziellen Stand von
[abeggled/openbridgeserver](https://github.com/abeggled/openbridgeserver) plus meinen eigenen
Änderungen, die (noch) nicht offiziell übernommen sind.

## Enthaltene Änderungen

| Änderung | Branch in diesem Fork | Pull Request bei abeggled |
|---|---|---|
| Link-Widget: einstellbare Icon-Größe | `feat/link-icon-size` | #1374 |
| Icons: PNG/JPEG importieren, eingebettete Bilder behalten | `feat/raster-icons` | eingereicht |
| Wortuhr: Minutenpunkte in den Ecken | `feat/wortuhr-minute-dots` | #1378 |
| Visu-Geräte: Startseite und Rücksprung je Gerät | `feat/visu-device-start-page` | eingereicht |
| Link-Widget: zurück zur zuvor besuchten Seite | `feat/link-history-back` | eingereicht |
| Visu: eigene Icons ohne Anmeldung (nur auf erlaubten Seiten, PIN-Seiten nach PIN) | `fix/visu-icons-public-pages` | eingereicht |
| Visu-Alarme: Meldung oder Seite bei Ereignissen in den Vordergrund (baut auf den Visu-Geräten auf) | `feat/visu-alarms` | eingereicht |
| Visu-Kopfleiste: einstellbar je Gerät (Titel, Menü-Knopf, Uhr, Werte, fixierbar) (baut auf den Visu-Alarmen auf) | `feat/visu-header` | noch nicht – erst lokaler Test |

Jeder `feat/…`- bzw. `fix/…`-Branch enthält genau eine Änderung, sauber auf dem offiziellen Stand aufgebaut.
`mein-stand` führt sie zusammen.

## Installiertes Paket

Das fertige Paket für den Proxmox-LXC-Container liegt im Branch `mein-stand-paket`
(`obs-mein-stand.tar.gz` mit Prüfsumme, `install.sh`, `PAKET.txt` mit Basis-Version und Datum).

Einspielen — **vorher in Proxmox einen Snapshot anlegen** — in der Container-Konsole als root:

```bash
curl -fsSL https://raw.githubusercontent.com/strippe186/openbridgeserver/mein-stand-paket/install.sh | bash
```

Zurück: Proxmox → Snapshots → Rollback.

## Wenn eine neue offizielle Version erscheint

`obs-update` spielt die offizielle Version ein und überschreibt dabei meine Erweiterungen.
**Das alte Paket danach nicht wieder einspielen** — es basiert auf der alten Version und würde
das Update teilweise rückgängig machen.

Stattdessen in Claude Code (mit diesem Fork als Repository) sagen:

> Baue `mein-stand` neu auf der offiziellen Version **X** auf (siehe MEIN-STAND.md) und
> erzeuge ein neues Paket.

Ablauf für Claude:

1. `upstream` = `https://github.com/abeggled/openbridgeserver`, den Tag der neuen Version bzw.
   `main` holen.
2. Für jede Zeile der Tabelle prüfen, ob die Änderung offiziell schon enthalten ist (PR gemergt
   oder Funktion im Code vorhanden). Enthaltene Änderungen aus der Tabelle streichen.
3. Die übrigen `feat/…`- und `fix/…`-Branches auf die neue Basis bringen (Merge der Basis in den Branch,
   Konflikte lösen) und pushen, damit offene PRs aktuell bleiben.
4. `mein-stand` neu von der Basis anlegen, alle übrigen `feat/…`- und `fix/…`-Branches hineinmergen, diese
   Datei übernehmen und die Tabelle aktualisieren.
5. Die Gates aus `AGENTS.md` laufen lassen (Lint, i18n, Help, beide Builds und Tests, pytest).
6. Paket bauen wie `tools/_lxc-inner.sh` (Abschnitt „App bundle“): `obs/`, `gui_dist/`,
   `frontend_dist/`, `help_dist/`, `requirements.txt`. Die Versionsnummer an **beiden** Stellen
   setzen, sonst zeigt das Admin-GUI `0.0.0-dev`: `obs/version` und vor dem GUI-Build
   `npm pkg set version=<Version> --prefix gui`; `<Version>` = `<Basis-Version>-dev+mein-stand`
   (Basis `main`) bzw. `<Basis-Version>+mein-stand` (Basis ein Release-Tag). Nach `mein-stand-paket` pushen (Paket, `.sha256`,
   `install.sh`, `PAKET.txt` aktualisieren).
7. Mir den Einspiel-Befehl von oben nennen.

Sind alle Änderungen offiziell übernommen, wird `mein-stand` nicht mehr gebraucht: einfach
`obs-update` nutzen.
