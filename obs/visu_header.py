"""Visu header — what the bar above a Visu page shows, per device profile.

The bar used to be fixed (breadcrumb, theme toggle, login). Now it can show a
menu button to a chosen page, the current page title, the time and date and up
to three datapoint values (e.g. the outside temperature), and every part can
be switched off — down to hiding the bar. A default applies to every Visu;
each Visu device profile can bring its own (`VisuDevice.header`).

The default is stored under the `visu.header` app setting. The datapoints a
header shows are display data the administrator chose for every viewer, so a
Visu page that may be viewed may also read them (read only, no history) —
see header_datapoint_ids().
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

logger = logging.getLogger(__name__)

VISU_HEADER_KEY = "visu.header"
MAX_HEADER_VALUES = 3


class HeaderValue(BaseModel):
    datapoint_id: str
    label: str = Field(default="", max_length=40)
    icon: str = Field(default="", max_length=200)
    decimals: int = Field(default=1, ge=0, le=3)

    @field_validator("datapoint_id")
    @classmethod
    def _check_datapoint(cls, value: str) -> str:
        try:
            return str(uuid.UUID(value))
        except ValueError as exc:
            raise ValueError("datapoint_id must be a UUID") from exc

    @field_validator("label", "icon")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()


class VisuHeader(BaseModel):
    """Defaults reproduce the previous fixed bar."""

    visible: bool = True
    # Keep the bar at the top while the page scrolls (e.g. on a phone).
    sticky: bool = False
    show_breadcrumb: bool = True
    show_title: bool = False
    menu_page_id: str | None = None
    # The menu button leads to the device profile's own start page instead of
    # menu_page_id — so one header serves Visus with different start pages.
    menu_to_start: bool = False
    menu_label: str = Field(default="", max_length=40)
    menu_icon: str = Field(default="", max_length=200)
    show_clock: bool = False
    show_date: bool = False
    values: list[HeaderValue] = Field(default_factory=list, max_length=MAX_HEADER_VALUES)
    # Arrows: back to the previously visited page / on to the next page in the same folder.
    show_back: bool = False
    show_next: bool = False
    # Where the arrows sit (at the bar's edges or right after the title), their
    # shape (thin ← → or bold ◀ ▶) and size ("auto": small on phones, larger on wide screens).
    arrow_position: Literal["edges", "title"] = "edges"
    arrow_style: Literal["thin", "bold"] = "thin"
    arrow_size: Literal["auto", "small", "medium", "large"] = "auto"
    show_theme_toggle: bool = True
    show_login: bool = True

    @field_validator("menu_page_id")
    @classmethod
    def _empty_page_is_none(cls, value: str | None) -> str | None:
        return value or None

    @field_validator("menu_label", "menu_icon")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def _one_menu_target(self) -> VisuHeader:
        if self.menu_to_start:
            self.menu_page_id = None
        return self


def parse_visu_header(raw: str) -> VisuHeader:
    """Validate a stored `visu.header` value; raises ValueError when invalid."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{VISU_HEADER_KEY} is not valid JSON") from exc
    return VisuHeader.model_validate(data)


def load_visu_header(raw: str | None) -> VisuHeader:
    """Read the stored default leniently: a broken value falls back to the classic bar."""
    if not raw:
        return VisuHeader()
    try:
        return parse_visu_header(raw)
    except ValueError:
        logger.warning("Ignoring invalid %s setting", VISU_HEADER_KEY)
        return VisuHeader()


def dump_visu_header(header: VisuHeader) -> str:
    return json.dumps(header.model_dump(), ensure_ascii=False)


async def read_default_header(db: Any) -> VisuHeader:
    row = await db.fetchone("SELECT value FROM app_settings WHERE key = ?", (VISU_HEADER_KEY,))
    return load_visu_header(row["value"] if row else None)


async def header_datapoint_ids(db: Any) -> set[str]:
    """Datapoints shown by the default header or any device profile's header."""
    from obs.visu_devices import VISU_DEVICES_KEY, load_visu_devices

    headers = [await read_default_header(db)]
    row = await db.fetchone("SELECT value FROM app_settings WHERE key = ?", (VISU_DEVICES_KEY,))
    headers += [d.header for d in load_visu_devices(row["value"] if row else None) if d.header]
    return {value.datapoint_id for header in headers for value in header.values}


def header_references(headers: list[VisuHeader]) -> tuple[set[str], set[str]]:
    """(menu page ids, datapoint ids) referenced by the given headers — for save-time validation."""
    pages = {h.menu_page_id for h in headers if h.menu_page_id}
    datapoints = {v.datapoint_id for h in headers for v in h.values}
    return pages, datapoints
