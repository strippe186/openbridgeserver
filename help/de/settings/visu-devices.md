---
title: Visu-Geräte
---

# Visu-Geräte

Den Reiter findest du im Admin-GUI unter **Einstellungen → Visu-Geräte**. Er ist nur für
Administratoren sichtbar.

## Startseite und Rücksprung je Gerät {#settings-visu-devices}

Eine Visu läuft oft auf mehreren Geräten gleichzeitig — auf dem Handy, einem Wandpanel im Flur,
einem Visu-PC. Jedes Gerät soll mit einer anderen Seite starten, und ein Wandpanel soll nach
einer Weile ohne Bedienung von selbst wieder auf seine Startseite zurückkehren. Dafür legst du
hier **Geräteprofile** an.

Jedes Profil hat:

| Feld | Bedeutung |
|---|---|
| **Name** | Frei wählbare Bezeichnung, z. B. „Wandpanel Flur“. Erscheint in der Geräte-Auswahl der Visu. |
| **Kennung** | Kurzer Name für den Link, nur Kleinbuchstaben, Ziffern und Bindestriche (z. B. `wandpanel-flur`). Wird beim Tippen des Namens vorgeschlagen. |
| **Startseite** | Die Seite, mit der die Visu auf diesem Gerät öffnet. „Übersicht“ behält das bisherige Verhalten. |
| **Rücksprung nach** | Zeit in Sekunden ohne Berührung, Maus-, Rad- oder Tastatureingabe, nach der die Visu zur Startseite zurückkehrt. `0` = nie. |

Mit **Speichern** werden alle Profile auf einmal übernommen. Zeilen mit Fehlern (leerer Name,
ungültige oder doppelte Kennung, Zeit außerhalb von 0–86400 Sekunden, gelöschte Startseite)
sind markiert und verhindern das Speichern.

### Ein Gerät einem Profil zuordnen

Das Profil wird **auf dem Gerät selbst** gewählt und dort im Browser gespeichert:

- **Per Link:** Jede Zeile zeigt den Link des Profils, z. B.
  `http://obs.local:8080/visu/?device=wandpanel-flur`. Öffne ihn einmal auf dem Gerät oder lege
  ihn dort als Lesezeichen bzw. Kiosk-Startadresse ab. `?device=none` löst das Gerät wieder vom
  Profil.
- **Per Auswahl:** Sobald Profile angelegt sind, zeigt die Übersicht der Visu oben rechts eine
  Auswahl **Gerät**.

Danach öffnet `/visu/` auf diesem Gerät direkt die Startseite des Profils. Änderungen an Startseite
oder Rücksprungzeit im Admin-GUI gelten beim nächsten Laden der Visu auf dem Gerät.

### Verhalten im Detail

- Zurückgesprungen wird nur aus der normalen Ansicht (Seite oder Übersicht) — nie aus dem
  Editor, der Seitenverwaltung oder einer Login- bzw. PIN-Eingabe.
- Ist die Startseite mit PIN oder Login geschützt, fragt die Visu beim Öffnen wie gewohnt danach.
  Das Profil selbst enthält keine Zugangsdaten.
- Wird die Startseite gelöscht, öffnet das Gerät stattdessen die Übersicht; im Reiter ist die Zeile
  markiert, bis eine andere Seite gewählt ist.
- Die Profile sind Teil der App-Einstellungen und damit in Konfigurations-Export, Backup und
  Werksreset enthalten.

## Kopfleiste der Visu {#settings-visu-header}

Die graue Leiste über jeder Visu-Seite ist einstellbar. Oben im Reiter legst du die
**Standard-Kopfleiste** fest; sie gilt für alle Geräte ohne eigene. Für ein einzelnes Profil
schaltest du **Eigene Kopfleiste für dieses Gerät** ein — das übernimmt die Standard-Kopfleiste
als Ausgangspunkt, danach kannst du sie für dieses Gerät anpassen, z. B. auf dem Handy nur Uhr und
Außentemperatur, auf dem Visu-PC zusätzlich den Pfad.

| Einstellung | Bedeutung |
|---|---|
| **Kopfleiste anzeigen** | Aus = keine Leiste, die Seite beginnt ganz oben. |
| **Fixieren** | Die Leiste bleibt beim Scrollen oben stehen, statt mit der Seite nach oben wegzuwandern — praktisch auf dem Handy. |
| **Seitenüberschrift** | Name der geöffneten Seite. |
| **Feste Breite der Überschrift** | Pixel ab Tablet-Breite; längere Seitennamen werden gekürzt. So bleiben Pfeile direkt hinter der Überschrift immer an derselben Stelle. `0` = so breit wie nötig. |
| **Pfad (Breadcrumb)** | Der bisherige Pfad „Haus › EG › Küche“. |
| **Menü-/Start-Knopf** | Ein Knopf links, der eine wählbare Seite öffnet, z. B. eine selbst gestaltete Menüseite — oder mit **Startseite des Geräts** die Startseite aus dem jeweiligen Geräteprofil (ohne Profil die Übersicht). So reicht eine Kopfleiste für Visus mit ganz verschiedenen Startseiten. Beschriftung und Icon sind frei; ohne Beschriftung erscheint der Name der Seite. Auf der Zielseite selbst wird er ausgeblendet. |
| **Pfeil ← / Pfeil →** | Einzeln schaltbar. **←** führt zur zuvor besuchten Seite (ohne Verlauf eine Ebene höher). **→** führt zur nächsten Seite im selben Ordner, in der Reihenfolge der Seitenverwaltung, nach der letzten wieder zur ersten; Unterordner werden übersprungen, ohne weitere Seite im Ordner bleibt der Pfeil weg. Auf dem Handy sind die Pfeile klein, auf breiteren Bildschirmen deutlich größer. Darunter wählst du **Anordnung** (am linken und rechten Rand, rechts neben der Überschrift oder links vor den Anzeigen rechts — auf dem Handy stehen sie dann immer an derselben Stelle), **Form** (dünn ← → oder dick ◀ ▶) und **Größe** (automatisch: Handy klein, PC groß — oder fest klein, mittel, groß). |
| **Uhrzeit / Datum** | Im Zeit- und Datumsformat aus **Einstellungen → Allgemein**. |
| **Datenpunkt-Werte** | Bis zu drei Werte, z. B. die Außentemperatur, je mit Bezeichnung, Icon und Nachkommastellen. Die Einheit kommt vom Datenpunkt. |
| **Tag/Nacht-Umschalter** | Der Knopf ☀️/🌙. |
| **Anmelden-Knopf** | Ohne ihn meldest du dich über die Adresse `/visu/login` an. Wer angemeldet ist, sieht den Knopf trotzdem, um sich abmelden zu können. |

Für Administratoren bleiben **Bearbeiten** und **Verwalten** immer sichtbar. Als Alarm-Popup
eingebettete Seiten zeigen keine Kopfleiste.

Die Werte der Kopfleiste sind **nur lesbar** und auf jeder Seite sichtbar, die der Betrachter
öffnen darf — also auch auf öffentlichen Seiten ohne Anmeldung. Wähle deshalb nur Datenpunkte, die
jeder sehen darf, der die Visu sieht. Schreiben lassen sie sich über die Kopfleiste nie.
