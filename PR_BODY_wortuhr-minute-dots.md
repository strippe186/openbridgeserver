## Beschreibung

The word clock mode of the Clock ("Uhr") widget rounds to the nearest five minutes, so it can never show the exact time — at 17:48 it already says "zehn vor sechs".

This PR adds the classic word-clock answer to that: four **minute dots** in the corners of the letter grid.

- New opt-in config key `minuteDots` (boolean, default `false` in `defaultConfig`). Widgets saved without the key keep exactly today's display and rounding.
- With the option on, the dots light up clockwise from the top-left corner for the 1–4 minutes past the last 5-minute step (top-left → top-right → bottom-right → bottom-left), and the words **round down** instead of to the nearest step, so words + dots always add up to the real time:
  - 17:47 → "es ist dreiviertel sechs" + 2 dots
  - 17:48 → "es ist dreiviertel sechs" + 3 dots (instead of "zehn vor sechs")
  - 17:59 → "es ist fünf vor sechs" + 4 dots (instead of jumping to "sechs Uhr")
  - 18:00 → "es ist sechs Uhr", no dot
- Lit dots use the widget's accent colour, unlit ones the same grey as unlit letters. Dot size and padding scale with the widget via container query units (`cqi`), like the letters.
- `Config.vue`: checkbox **Minute dots in the corners** with a hint, shown only in word clock mode; new keys `widgets.uhr.minuteDots` / `widgets.uhr.minuteDotsHint` in `frontend/src/locales/de.json` and `en.json`.
- Because the i18n guard scans each changed file as a whole, the remaining hardcoded texts in the Clock `Config.vue` (two placeholders, the "(optional)" hint, the IANA format hint and the colour picker title) now go through vue-i18n too (separate commit, de + en).
- Release note added under 2026.11.0 → New features.

Help: the Clock widget has no help section yet (`widget:Uhr` is on the help-contract allowlist as tracked debt), so the help contract stays green unchanged.

Tested manually on an LXC installation (Visu `frontend_dist` swapped in): dots and words behave as described above.

## Typ der Änderung

- [ ] Bug-Fix
- [x] Neues Feature
- [ ] Release-Engineering / CI / Dokumentation
- [ ] Backport → Label `backport-YYYY.M` setzen, Ziel-Branch `YYYY.M` angeben

## Milestone

2026.11 (please set in the sidebar).

## Checkliste

- [x] Tests für neue oder geänderte Funktionalität vorhanden — `frontend/src/widgets/Uhr/Widget.test.ts` (no dots and nearest-step rounding without the option; 17:47 / 17:48 / 17:59 / 18:00 with the option, checking the lit letters and which dots are lit; accent colour vs. grey; clockwise corner placement) and the new `frontend/src/widgets/Uhr/Config.test.ts` (option only in word clock mode, default off for widgets without the key, loading and emitting the value, translated placeholders/hints)
- [x] Lokale Gates grün: `./tools/lint.sh --check`; Visu: `cd frontend && npm run build && npm run test` (42 files / 706 tests); GUI is not touched by this PR, `cd gui && npm run build && npm run test:coverage` green anyway (Node 24 per `.nvmrc`)
- [x] Neue nutzer-sichtbare Strings in `en.json` **und** `de.json` eingetragen (i18n-Guard: `./tools/check-i18n-hardcoded-strings.sh` OK)
- [x] Release Notes in `RELEASENOTES.md` aktualisiert (wenn nutzer-relevant)

Additionally: `python tools/check_help_contract.py` passes.
