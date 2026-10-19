## Beschreibung

A Link widget always navigates to its fixed `target_node_id`. A "back" button that sits on many pages and can be reached from different places therefore cannot return to where the user actually came from — it always jumps to the same page.

This PR adds an optional **history back** mode to the Link widget:

- New config key `history_back` (boolean, default `false` in `defaultConfig`). Existing links are unchanged.
- With the option set, a click calls `router.back()` and returns to the previously visited page, wherever the user came from.
- If there is no history — `window.history.state.back` is empty, e.g. the page was opened directly or the browser was just started — the link falls back to `target_node_id` exactly as before (including the existing LOCATION/first-page handling). Without history and without a target it does nothing.
- A link with the option set shows the arrow and no "no target" hint, since it has a destination even without `target_node_id`.
- No navigation in editor mode, as before.
- `Config.vue`: checkbox (re-synced on widget switch); new key `widgets.link.historyBack` in `frontend/src/locales/de.json` and `en.json`. The other Visu locales (`es`, `fr`, `gsw`, `it`) have no `widgets.link` namespace yet and fall back to English, like all other Link strings.
- Release note added under 2026.11.0 → New features (separate `docs(releasenotes)` commit).

The new option and the release note entry are placed so that this PR and #1374 (Link widget icon size), which touch the same files, merge cleanly in either order (checked with `git merge-tree`). The tests live in their own file `Link/Widget.historyBack.test.ts`, because `Link/Widget.test.ts` is added by #1374.

Help: the Link widget has no help section yet (`widget:Link` is on the help-contract allowlist as tracked debt), so the help contract stays green unchanged.

## Typ der Änderung

- [ ] Bug-Fix
- [x] Neues Feature
- [ ] Release-Engineering / CI / Dokumentation
- [ ] Backport → Label `backport-YYYY.M` setzen, Ziel-Branch `YYYY.M` angeben

## Milestone

2026.11 (please set in the sidebar).

## Checkliste

- [x] Tests für neue oder geänderte Funktionalität vorhanden — `frontend/src/widgets/Link/Widget.historyBack.test.ts`: without the option the link pushes its target even with history; with the option and history → `router.back()`; with the option and no history → push to `target_node_id`; no history and no target → nothing; no navigation in the editor; no "no target" hint with the option, hint still shown without it; config default off, loading/emitting the value and re-sync on widget switch.
- [x] Lokale Gates grün: `./tools/lint.sh --check`; Visu: `cd frontend && npm run build && npm run test` (42 files / 704 tests); GUI is not touched by this PR, `cd gui && npm run build && npm run test:coverage` green anyway (Node 24 per `.nvmrc`)
- [x] Neue nutzer-sichtbare Strings in `en.json` **und** `de.json` eingetragen (i18n-Guard: `./tools/check-i18n-hardcoded-strings.sh` OK)
- [x] Release Notes in `RELEASENOTES.md` aktualisiert (wenn nutzer-relevant)

Additionally: `python tools/check_help_contract.py` passes.
