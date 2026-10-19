## Beschreibung

The Visu always opens the overview (`/visu/` → `/visu/tree`), on every device. In practice a Visu runs on several devices at once — a phone, a wall panel, a desktop PC — and each wants its own start page; a wall panel additionally wants to fall back to its start page after nobody has touched it for a while.

This PR adds centrally managed **Visu device profiles**:

**Backend**
- New module `obs/visu_devices.py`: a profile has a URL `slug` (`[a-z0-9]` with inner hyphens, max. 40), a `name`, an optional `start_node_id` and `return_after_s` (0–86400, 0 = never). Max. 50 profiles, unique slugs.
- Stored as one JSON document under the app setting `visu.devices` — so configuration export/import, autobackup and factory reset carry it like every other app setting; no table, no migration. Reading is lenient: a broken stored value yields no profiles instead of breaking the Visu.
- `GET /api/v1/system/visu-devices` — **public**, like `/system/display-settings`, because the Visu runs on anonymous/PIN devices. The profiles hold no credentials; a protected start page still asks for its PIN or login when opened. Added to `PUBLIC_ROUTE_ALLOWLIST` and the route classification.
- `PUT /api/v1/system/visu-devices` — replaces all profiles, **admin only**, audited as `system.visu_devices.updated` (security contract registry updated, count 114 → 115). Unknown start pages → 422.
- Config import validates `visu.devices` like the regional/date settings; an invalid value is reported in `errors` and skipped, the other settings still import.

**Admin GUI**
- New admin-only settings tab **Visu-Geräte** (`VisuDevicesPanel.vue`): edit all profiles in place — name, identifier (suggested from the name, umlauts transliterated), start page (all Visu nodes with their full path, or "Overview"), return time in seconds — and save them at once. Each row shows the device link `/visu/?device=<slug>` with a copy button. Rows with errors (empty name, invalid/duplicate identifier, out-of-range time, deleted start page) are marked and block saving.

**Visu**
- `stores/device.ts`: which profile *this* device uses is stored in the browser (`localStorage`, guarded for blocked storage).
- `?device=<slug>` on any Visu URL selects the profile; `?device=none` (or empty) releases it. The overview header shows a **Device** selector once profiles exist.
- `/visu/` now goes through a `beforeEnter` guard and opens the profile's start page; without a profile or start page it opens the overview as before. (A static `redirect` cannot be used — vue-router resolves it before any guard.)
- `composables/useIdleReturn.ts`: with a return time set, the Visu navigates back to the start page after that long without `pointerdown`/`pointermove`/`keydown`/`wheel`/`touchstart`. It only returns from a page or the overview — never from the editor, the page management or a login/PIN prompt — and does nothing when already there.
- The overview header now wraps on narrow screens (the selector would otherwise push the theme toggle and login button off a phone screen); its product name goes through i18n (`tree.productName`, like `sidebar.productName` in the Admin GUI), since the i18n guard scans the whole changed file.

**Docs:** new help page `help/{de,en}/settings/visu-devices.md` (`{#settings-visu-devices}`), linked in the sidebar and the settings index; release note under 2026.11.0 → New features.

Without any profile, behaviour is unchanged.

Tested end-to-end on a build of this branch (app bundle, Chromium via Playwright): profiles created through the new tab, `/visu/?device=…` opens the start page and is remembered, the panel returns to its start page after the idle time and not while being used, a fresh device opens the overview with the selector, no horizontal overflow at 390 px. Also tested manually on an LXC installation (app bundle of this branch): profiles, device link, start page and return-to-start work as described.

## Typ der Änderung

- [ ] Bug-Fix
- [x] Neues Feature
- [ ] Release-Engineering / CI / Dokumentation
- [ ] Backport → Label `backport-YYYY.M` setzen, Ziel-Branch `YYYY.M` angeben

## Milestone

2026.11 (please set in the sidebar).

## Checkliste

- [x] Tests für neue oder geänderte Funktionalität vorhanden
  - Backend: `tests/unit/test_visu_devices.py` (model validation, lenient load, round trip, routes incl. audit row and 422 for unknown start pages, config import with an invalid and a valid value next to an unrelated key) and `tests/integration/test_visu_devices.py` (public GET, PUT as admin / non-admin / anonymous, validation cases, config import).
  - Admin GUI: `gui/tests/components/settings/VisuDevicesPanel.spec.js` (100 % lines and branches of the panel), `gui/tests/views/SettingsView.visuDevices.spec.js` (tab for admin / hidden for non-admin / read-only for demo), `gui/tests/api/client.visuDevices.spec.js`.
  - Visu: `src/stores/device.test.ts`, `src/composables/useIdleReturn.test.ts`, `src/router/index.test.ts`, `src/views/VisuTree.test.ts`.
- [x] Lokale Gates grün: `./tools/lint.sh --check`; `cd gui && npm run build && npm run test:coverage` (214 files / 3445 tests); `cd frontend && npm run build && npm run test` (45 files / 729 tests); `pytest tests/unit tests/adapters tests/contracts` (8910 passed, 1 environment-specific failure: `test_icons_coverage.py::test_list_icons_skips_unreadable_file` relies on `chmod 000`, which does not hold when running as root — fails identically on `main`); `pytest tests/integration` (1046 passed). Node 24 per `.nvmrc`.
- [x] Neue nutzer-sichtbare Strings in `en.json` **und** `de.json` eingetragen (i18n-Guard: `./tools/check-i18n-hardcoded-strings.sh` OK)
- [x] Release Notes in `RELEASENOTES.md` aktualisiert (wenn nutzer-relevant)

Additionally: `python tools/check_help_contract.py` passes (82 help_id references resolved).
