## Beschreibung

Icons are stored and served as SVG everywhere (`obs/api/v1/icons.py`: import, list, export, get), and `_sanitize_svg` strips every `href`/`xlink:href` that starts with `data:`. Two consequences:

1. There is no way to use an icon that only exists as a picture (PNG/JPEG).
2. SVGs that **embed** a bitmap — typical for Inkscape, which writes `<image xlink:href="data:image/png;base64,…">` — import "successfully" but end up as an empty file of ~1 KB, because the sanitizer removes the embedded image.

This PR keeps the "everything is SVG" model and adds the minimum needed on top:

**Sanitizer (backend `_sanitize_svg` and the Visu's `useIcons` sanitizer)**
- `href`/`xlink:href` is kept only if the element is `<image>` **and** the value (after removing control characters/whitespace, lower-cased) fully matches `data:image/(png|jpeg|gif|webp);base64,<base64>`.
- Still removed: `data:image/svg+xml` (base64 or not), non-base64 payloads, any other `data:` type, `javascript:` (incl. obfuscated), and raster data URIs on any element other than `<image>` (`<a>`, `<use>`, `<feImage>`, `<pattern>`, …). Event handlers on `<image>` are still stripped. In the Visu sanitizer, `src` is unchanged (still blocked).

**Import (`POST /api/v1/icons/import`, single files and ZIP members)**
- Content starting with the PNG or JPEG signature is wrapped into a minimal SVG:
  `<svg xmlns="http://www.w3.org/2000/svg" width="W" height="H" viewBox="0 0 W H"><image width="W" height="H" href="data:image/png;base64,…"/></svg>`
  W/H come from the PNG `IHDR` chunk or the JPEG start-of-frame segment, parsed with `struct` — no new dependency (Pillow is not in `requirements.txt`). The wrapper then goes through `_sanitize_svg` like any other upload.
- Detection is by content, not extension, exactly as for SVGs; the icon name is the file stem as before. ZIP members with `.png`/`.jpg`/`.jpeg` are now considered (previously only `.svg` and extension-less members).
- Limits (there was none before): max. 1 MB per raster image (the list endpoint inlines every icon's content) and 16384 px per side. An oversized/unreadable image → `422` with the file name; inside a ZIP this aborts the whole import, consistent with how a broken SVG member is handled (atomic import). Non-image ZIP members are still skipped.
- List/export/get are unchanged: a raster icon is an ordinary `.svg` file, so export → re-import round-trips.

**Admin GUI**
- Icon file picker: `accept=".svg,.png,.jpg,.jpeg,.zip"`. There is no further client-side type validation (the server decides by content).
- Updated `settings.icons.importTitle` / `importDesc` / `dropzone` (de/en) and replaced the hardcoded `'Upload fehlgeschlagen'` fallback with the new key `settings.icons.uploadFailed`.

**Inline rendering / XSS review**
- `gui/src/views/SettingsView.vue` renders the icon grid with `v-html="icon.content"` (backend-sanitized), and `gui/src/components/ui/VisuIcon.vue` inlines icons via `v-html` too. In the Visu, `frontend/src/widgets/Stufenschalter/Widget.vue` inlines `getSvg()` output (sanitized by `useIcons`) via `v-html`; `VisuIcon.vue` renders icons as `<img src="blob:…">`.
- The only newly allowed construct is a base64 `image/png|jpeg|gif|webp` data URI as the source of an SVG `<image>`. Browsers decode such a resource as a raster image; it cannot contain or run script, cannot reference other resources, and does not create a navigable link. `data:image/svg+xml` (which could carry script when loaded as a document) stays blocked, as do all data URIs on `<a>`, `<use>` and other elements. So the inline `v-html` paths remain safe.
- `frontend/src/widgets/Toggle/Widget.vue` has its own stricter sanitizer that removes `<image>` entirely (it recolours icons to `currentColor`); it is intentionally left unchanged, so a raster icon shows as empty in the Toggle widget's recoloured mode.

**Docs:** `help/{de,en}/settings/icons.md` (section `{#settings-icons-import}`, anchor unchanged) and a release note under 2026.11.0 → New features.

Note: like coloured SVGs, raster icons are shown as a single-colour silhouette wherever the UI applies `brightness-0 dark:invert` (Admin icon grid, Visu without "Preserve SVG icon color"); this is documented in the help text.

## Typ der Änderung

- [ ] Bug-Fix
- [x] Neues Feature
- [ ] Release-Engineering / CI / Dokumentation
- [ ] Backport → Label `backport-YYYY.M` setzen, Ziel-Branch `YYYY.M` angeben

## Milestone

2026.11 (please set in the sidebar).

## Checkliste

- [x] Tests für neue oder geänderte Funktionalität vorhanden
  - `tests/unit/test_icons_raster.py` (new): sanitizer keeps PNG/JPEG/GIF/WebP base64 URIs on `<image>` (also namespaced + line-wrapped as written by Inkscape) and strips `data:image/svg+xml`, non-base64, `data:text/html`, `image/bmp`, `javascript:` (plain and obfuscated) on `<image>`, and raster URIs on `<a>`/`<use>`/`<feImage>`/`<pattern>` (`href` and `xlink:href`); PNG/JPEG size parsing incl. SOF2, fill bytes, standalone markers, DHT, truncated/garbage input; wrapper has correct `width`/`height`/`viewBox` and payload; size/dimension limits; import of single PNG/JPEG, PNG with `.svg` name, Inkscape SVG with embedded PNG, ZIP with PNG/JPG/extension-less/SVG/non-image members, unsafe names, atomic failure for an oversized PNG in a ZIP.
  - `tests/integration/test_icons.py`: PNG upload is listed and served as `image/svg+xml` with the right `viewBox` and data URI; `GET` keeps an embedded PNG but strips `data:image/svg+xml` and a PNG URI on `<use>`.
  - `frontend/src/composables/useIcons.test.ts`: Visu sanitizer keeps raster URIs on `<image>` and strips the blocked variants.
  - `gui/tests/views/SettingsView.icons-errors.spec.js`: `accept` includes `.png/.jpg/.jpeg`, server detail and the translated fallback on upload errors.
- [x] Lokale Gates grün: `./tools/lint.sh --check`; `cd gui && npm run build && npm run test:coverage` (211 files / 3426 tests); `cd frontend && npm run build && npm run test` (41 files / 703 tests); `pytest tests/unit tests/adapters tests/contracts` (8934 passed, 1 environment-specific failure, see below); `pytest tests/integration` (1036 passed)
- [x] Neue nutzer-sichtbare Strings in `en.json` **und** `de.json` eingetragen (i18n-Guard OK)
- [x] Release Notes in `RELEASENOTES.md` aktualisiert (wenn nutzer-relevant)

Additionally: `python tools/check_help_contract.py` passes. The one local unit failure, `tests/unit/test_icons_coverage.py::test_list_icons_skips_unreadable_file`, is pre-existing and unrelated: it relies on `chmod 000` making a file unreadable, which does not hold when the suite runs as root (it fails identically on `main` in that environment).
