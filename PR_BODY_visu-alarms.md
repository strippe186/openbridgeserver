## Beschreibung

> **Builds on the Visu device profiles PR** (`feat/visu-device-start-page`): alarms can be limited to device profiles. This branch contains those commits too; please review/merge that PR first — the alarm changes are the last five commits.

The Visu has no way to bring something to the foreground when an event happens — e.g. "Mail has arrived" when the mailbox contact triggers, or a notice while the phone rings. Visitors only see what is on the page they have open, and an anonymous Visu only receives live values for the datapoints of that page (none at all on the overview).

This PR adds **Visu alarms**:

**Backend** (`obs/visu_alarms.py`, `obs/api/v1/visu_alarms.py`)
- An alarm watches one datapoint with a MESSAGE-style condition (`==`, `!=`, `<`, `<=`, `>`, `>=`, `contains`, `contains not`, `starts with`, `ends with`; `evaluate_condition` from the MESSAGE adapter is reused). It is raised on the **rising edge** of the condition. Nothing is raised for a state that was already true when the definitions were saved or the server started.
- Display: `message` (title, text, icon, severity info/warning/critical) or `page` (a Visu page shown as popup). End: `ack_button` and/or `end_on_clear` (at least one). Optional `sound`. `devices`: device profile slugs, empty = every Visu.
- Definitions are stored as one JSON document under the app setting `visu.alarms` (like `visu.devices`): export/import, autobackup and factory reset carry them; config import validates the setting, and import and reset reload the running engine (a reload failure is logged, never fails the import/reset).
- `VisuAlarmEngine` subscribes to `DataValueEvent` (ignores `initialization` events), keeps the active alarms in memory and pushes the full active list to every listener after each change.
- Routes, all under `/api/v1/system`:
  - `GET/PUT /visu-alarms` — definitions, admin only; PUT is audited as `system.visu_alarms.updated` (security contract registry 115 → 116) and rejects unknown datapoints and pages.
  - `GET /visu-alarms/active` and `WEBSOCKET /visu-alarms/ws` — **public** (added to `PUBLIC_ROUTE_ALLOWLIST`), like `/display-settings` and `/visu-devices`: alarms must reach anonymous and PIN-only devices and the overview. They carry only the display data the administrator wrote (`id, name, display, title, text, icon, severity, page_id, ack_button, sound, devices, since`), never datapoint values. A dedicated channel instead of widening the datapoint WebSocket keeps that connection's page scoping untouched.
  - `POST /visu-alarms/{id}/acknowledge` — public and rate limited (30/min), so a wall panel without login can acknowledge; classified `data_mutation`. Acknowledging ends the alarm on every device.

**Admin GUI** — new admin-only settings tab **Visu-Alarme** (`VisuAlarmsPanel.vue`): one collapsible card per alarm with trigger (`DpCombobox`, condition, compare value), display (message with `IconPicker`, or page with the full page path), end, sound and device checkboxes; invalid alarms are flagged and block saving.

**Visu**
- `AlarmOverlay.vue` (mounted in `App.vue`) uses `useVisuAlarms` (own WebSocket to the alarm channel, reconnect with back-off) and shows the newest alarm meant for this device: a message window, or a popup that embeds the page as `/visu/<id>?embed=1` — widgets, live values and PIN prompts work as on the page itself. "Acknowledge" where configured, a note when more alarms are waiting, an optional signal tone (WebAudio, once per newly arrived alarm; browsers allow it after the first interaction).
- `?embed=1` (remembered per frame in sessionStorage) hides the viewer header and disables the overlay and the idle return inside the popup. Deliberately not detected via `window.top`, so a Visu that users embed in other dashboards is unchanged.

**Docs:** `help/{de,en}/settings/visu-alarms.md` (`{#settings-visu-alarms}`), sidebar and settings index; release note under 2026.11.0 → New features.

Tested end to end (app bundle, Chromium via Playwright, two anonymous browsers — one on the overview without profile, one wall panel with a device profile): a value change on the mailbox datapoint shows the message on both; acknowledging on one closes it on both; the phone alarm (page popup, wall panel only, ends on clear) appears only on the wall panel with the embedded page and disappears when the value goes back.

## Typ der Änderung

- [ ] Bug-Fix
- [x] Neues Feature
- [ ] Release-Engineering / CI / Dokumentation
- [ ] Backport → Label `backport-YYYY.M` setzen, Ziel-Branch `YYYY.M` angeben

## Milestone

2026.11 (please set in the sidebar).

## Checkliste

- [x] Tests für neue oder geänderte Funktionalität vorhanden
  - Backend: `tests/unit/test_visu_alarms.py` (100 % lines and branches of `obs/visu_alarms.py` and `obs/api/v1/visu_alarms.py`: model validation, edges, acknowledge, end on clear, initialization events, configure from current values, listeners incl. back-pressure, routes incl. audit and 422s, live channel incl. keepalive and failed sends) and `tests/integration/test_visu_alarms.py` (admin-only config, unknown datapoint, value write → anonymous active list → anonymous acknowledge, end-on-clear alarm following the datapoint).
  - Admin GUI: `gui/tests/components/settings/VisuAlarmsPanel.spec.js` (100 % lines and branches), tab tests in `SettingsView.visuDevices.spec.js`, client test.
  - Visu: `AlarmOverlay.test.ts`, `useVisuAlarms.test.ts`, `embed.test.ts`, `alarmTone.test.ts`, embedded header in `VisuViewer.test.ts`.
- [x] Lokale Gates grün: `./tools/lint.sh --check`; `cd gui && npm run build && npm run test:coverage`; `cd frontend && npm run build && npm run test`; `pytest tests/unit tests/adapters tests/contracts` (1 environment-specific failure: `test_icons_coverage.py::test_list_icons_skips_unreadable_file` relies on `chmod 000`, which does not hold when running as root — fails identically on `main`); `pytest tests/integration`. Node 24 per `.nvmrc`.
- [x] Neue nutzer-sichtbare Strings in `en.json` **und** `de.json` eingetragen (i18n-Guard: `./tools/check-i18n-hardcoded-strings.sh` OK)
- [x] Release Notes in `RELEASENOTES.md` aktualisiert (wenn nutzer-relevant)

Additionally: `python tools/check_help_contract.py` passes.
