# feat(visu): optional icon size for the Link widget

## Beschreibung

The Link widget always renders its icon at the fixed `text-4xl` size, and `VisuIcon` fits every SVG icon into a `1em × 1em` square. A wide SVG — e.g. a car picture with a 393×207 viewBox — therefore shrinks to a thin strip in the middle of the tile, and there is no way to make an icon larger than `text-4xl`.

This PR adds an optional **Icon size (px)** setting to the Link widget:

- New config key `icon_size` (number, px). `0`, missing or an invalid value keeps the current rendering exactly (`text-4xl`, 1em square), so existing widgets are unchanged. `defaultConfig` gets `icon_size: 0`.
- With a size set, the icon wrapper spans the tile (`block w-full text-center`) and uses that `font-size`. Emoji simply scale with it.
- `VisuIcon.vue` gets an opt-in `fitWidth` prop: the SVG is rendered `h-[1em] w-auto max-w-full` instead of `w-[1em] h-[1em]`, so it keeps its aspect ratio and never gets wider than the tile. All other callers keep the 1em square (prop defaults to `false`).
- Link `Config.vue`: numeric input (`min=0`) with label and hint, new keys `widgets.link.iconSize` / `widgets.link.iconSizeHint` in `frontend/src/locales/de.json` and `en.json` (the other Visu locales have no `widgets.link` namespace yet; they fall back to `en`).
- Release note added under 2026.11.0 → New features.

Help: the Link widget has no help section yet (`widget:Link` is on the help-contract allowlist as tracked debt), so there is no existing option list to extend; the help contract stays green unchanged.

## Typ der Änderung

- [ ] Bug-Fix
- [x] Neues Feature
- [ ] Release-Engineering / CI / Dokumentation
- [ ] Backport → Label `backport-YYYY.M` setzen, Ziel-Branch `YYYY.M` angeben

## Milestone

2026.11 (please set in the sidebar).

## Checkliste

- [x] Tests für neue oder geänderte Funktionalität vorhanden — `frontend/src/widgets/Link/Widget.test.ts` (default class without `icon_size`; fallback for `0`, negative, non-numeric and `null`; custom `font-size`; numeric string; SVG rendered as 1em square by default vs. `w-auto max-w-full` with a size; `show_icon: false`) and `frontend/src/widgets/Link/Config.test.ts` (default `0`, loading/emitting a number, re-sync on widget switch incl. missing key)
- [x] Lokale Gates grün: `./tools/lint.sh --check`; Visu: `cd frontend && npm run build && npm run test` (43 files / 708 tests). GUI is not touched by this PR.
- [x] Neue nutzer-sichtbare Strings in `en.json` **und** `de.json` eingetragen (i18n-Guard: `./tools/check-i18n-hardcoded-strings.sh` OK)
- [x] Release Notes in `RELEASENOTES.md` aktualisiert (wenn nutzer-relevant)

Additionally: `python tools/check_help_contract.py` passes (13 routes, 24 widgets, 49 logic blocks, 81 help_id references).
