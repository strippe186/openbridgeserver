## Beschreibung

Custom icons (imported SVG, KNX UF, FontAwesome) are only shown in the Visu while signed in. The Visu loads them through `GET /api/v1/icons/` (`frontend/src/composables/useIcons.ts`), and both icon read routes depend on `get_current_user`. Anonymous and PIN visitors therefore get a 401, `useIcons` falls back to an empty list, and every `svg:<name>` icon renders empty — even on public pages. Emojis are unaffected, which hides the problem until the Visu is used without login.

This PR lets visitors without login load exactly the icons the Visu would show them anyway, and nothing more:

**Backend**
- `GET /api/v1/icons/` and `GET /api/v1/icons/{name}` now use the same optional principal as the Visu tree (`_optional_visu_principal`). Signed-in callers (user or API key) get every icon, as before.
- Without login, `anonymous_visible_icon_names()` (new, in `obs/api/v1/visu.py`) decides, using the existing access resolution (`_resolve_access_with_node`, i.e. `authz_visu_page_policies` with inheritance):
  - the node icon of every node the tree lists for anonymous visitors (all but `user` nodes) — otherwise the overview tiles would be empty;
  - every `svg:<name>` reference in the `page_config` of `public` and `readonly` pages (searched recursively, so all widget config fields are covered);
  - icons in the `page_config` of `protected` pages only if a valid PIN session token for the area's defining node is sent (`validate_session`, same check as page reads). The Visu sends all PIN tokens it holds in `X-Session-Tokens` (comma-separated), because the icon list is loaded once for all pages.
- Icons used only on login-only pages, or not used at all, stay hidden: they are left out of the list, and `GET /icons/{name}` answers 401 for them, as before.
- Upload, import, delete and settings routes are unchanged (admin / login required).

**Visu**
- `getAllSessionTokens()` in `api/client.ts` collects the valid PIN tokens (dropping expired ones); `icons.list()` sends them.
- `useIcons` remembers for which login state and set of PIN tokens the list was loaded and reloads it when that changes — so icons on a PIN page appear right after the PIN was entered, and all icons after login.

**Docs:** `help/{de,en}/settings/icons.md` explains which icons are visible without login; release note under 2026.11.0 → Fixes (separate `docs(releasenotes)` commit).

Note on tests: the existing direct calls of `list_icons`/`get_icon` in `tests/unit/test_coverage_api_auth_icons_dp.py` and `tests/unit/test_icons_coverage.py` now pass a signed-in principal instead of `_user="admin"`; `tests/integration/test_icons.py::test_list_icons_requires_auth` became `test_list_icons_without_login_hides_icons_no_public_page_uses`, since an anonymous list request now returns 200 with only the visible icons.

## Typ der Änderung

- [x] Bug-Fix
- [ ] Neues Feature
- [ ] Release-Engineering / CI / Dokumentation
- [ ] Backport → Label `backport-YYYY.M` setzen, Ziel-Branch `YYYY.M` angeben

## Milestone

2026.11 (please set in the sidebar).

## Checkliste

- [x] Tests für neue oder geänderte Funktionalität vorhanden
  - `tests/unit/test_visu_icon_visibility.py`: public, inherited-public, read-only, PIN (own and inherited), login-only and broken-config pages; valid / foreign / unknown PIN tokens; header parsing; `list_icons` and `get_icon` without login, with an unlocked PIN area and signed in.
  - `tests/integration/test_visu_icon_visibility.py`: end to end through the API — public icon visible, PIN and login-only icons hidden (list and `GET /icons/{name}` → 401), PIN entered via `POST /visu/nodes/{id}/auth` → PIN icon visible, login-only still hidden, signed in → everything.
  - Visu: `src/api/client.test.ts` (token collection incl. expiry and legacy format, header only with tokens), `src/composables/useIcons.test.ts` (no reload while nothing changes, reload after PIN entry and after login, retry after a failed load).
- [x] Lokale Gates grün: `./tools/lint.sh --check`; `cd gui && npm run build && npm run test:coverage`; `cd frontend && npm run build && npm run test`; `pytest tests/unit tests/adapters tests/contracts` (1 environment-specific failure: `test_icons_coverage.py::test_list_icons_skips_unreadable_file` relies on `chmod 000`, which does not hold when running as root — fails identically on `main`); `pytest tests/integration`. Node 24 per `.nvmrc`.
- [x] Neue nutzer-sichtbare Strings in `en.json` **und** `de.json` eingetragen (none added; i18n guard OK)
- [x] Release Notes in `RELEASENOTES.md` aktualisiert (wenn nutzer-relevant)

Additionally: `python tools/check_help_contract.py` passes.
