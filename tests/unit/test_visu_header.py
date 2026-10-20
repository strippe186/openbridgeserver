"""Unit tests — Visu header bar (model, routes, datapoint read release)."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, WebSocketDisconnect
from starlette.requests import Request

import obs.api.auth as auth_api
from obs.api.v1 import websocket as ws_api
from obs.api.v1.system import get_visu_header, update_visu_devices, update_visu_header
from obs.db.database import Database
from obs.visu_devices import VISU_DEVICES_KEY, VisuDevicesIn
from obs.visu_header import (
    MAX_HEADER_VALUES,
    VISU_HEADER_KEY,
    HeaderValue,
    VisuHeader,
    dump_visu_header,
    header_datapoint_ids,
    header_references,
    load_visu_header,
    parse_visu_header,
)

DP = "11111111-1111-1111-1111-111111111111"
DP2 = "22222222-2222-2222-2222-222222222222"


def _request(path: str = "/api/v1/system/visu-header") -> Request:
    return Request({"type": "http", "method": "PUT", "path": path, "headers": [], "client": ("127.0.0.1", 1), "query_string": b""})


# ── Model ─────────────────────────────────────────────────────────────────────


def test_defaults_reproduce_the_classic_bar():
    header = VisuHeader()
    assert (header.visible, header.sticky, header.show_breadcrumb, header.show_title) == (True, False, True, False)
    assert (header.menu_page_id, header.show_clock, header.show_date, header.values) == (None, False, False, [])
    assert (header.show_theme_toggle, header.show_login) == (True, True)
    assert (header.show_back, header.show_next) == (False, False)
    assert VisuHeader(show_back=True, show_next=True).model_dump()["show_next"] is True


def test_normalisation_and_limits():
    header = VisuHeader(
        menu_page_id="", menu_label=" Menü ", menu_icon=" ☰ ", values=[{"datapoint_id": DP.upper(), "label": " Außen ", "icon": " 🌡 "}]
    )
    assert (header.menu_page_id, header.menu_label, header.menu_icon) == (None, "Menü", "☰")
    assert header.values == [HeaderValue(datapoint_id=DP, label="Außen", icon="🌡", decimals=1)]
    with pytest.raises(ValueError, match="datapoint_id must be a UUID"):
        HeaderValue(datapoint_id="nope")
    with pytest.raises(ValueError):
        HeaderValue(datapoint_id=DP, decimals=4)
    with pytest.raises(ValueError):
        VisuHeader(values=[{"datapoint_id": DP}] * (MAX_HEADER_VALUES + 1))


def test_stored_value_round_trip_and_lenient_load(caplog):
    header = VisuHeader(menu_label="Menü", sticky=True)
    assert parse_visu_header(dump_visu_header(header)) == header
    assert "Menü" in dump_visu_header(header)
    with pytest.raises(ValueError, match="not valid JSON"):
        parse_visu_header("{broken")
    assert load_visu_header(None) == VisuHeader()
    assert load_visu_header('{"values": "x"}') == VisuHeader()
    assert VISU_HEADER_KEY in caplog.text


def test_menu_to_start_replaces_a_menu_page():
    assert VisuHeader().menu_to_start is False
    header = VisuHeader(menu_to_start=True, menu_page_id="menu")
    assert (header.menu_to_start, header.menu_page_id) == (True, None)
    assert header_references([header]) == (set(), set())
    assert VisuHeader(menu_page_id="menu").menu_page_id == "menu"


def test_header_references():
    headers = [VisuHeader(menu_page_id="menu", values=[{"datapoint_id": DP}]), VisuHeader(values=[{"datapoint_id": DP2}])]
    assert header_references(headers) == ({"menu"}, {DP, DP2})
    assert header_references([]) == (set(), set())


# ── Storage and routes ────────────────────────────────────────────────────────


@pytest.fixture
async def db():
    database = Database(":memory:")
    await database.connect()
    now = datetime.now(UTC).isoformat()
    for dp_id in (DP, DP2):
        await database.execute_and_commit(
            "INSERT INTO datapoints (id, name, mqtt_topic, created_at, updated_at) VALUES (?, 'X', ?, ?, ?)", (dp_id, f"dp/{dp_id}", now, now)
        )
    await database.execute_and_commit(
        "INSERT INTO visu_nodes (id, name, type, node_order, created_at, updated_at) VALUES ('menu', 'Menü', 'PAGE', 0, ?, ?)", (now, now)
    )
    try:
        yield database
    finally:
        await database.disconnect()


async def test_header_datapoints_come_from_the_default_and_every_device(db):
    assert await header_datapoint_ids(db) == set()
    await db.execute_and_commit(
        "INSERT INTO app_settings (key, value) VALUES (?, ?)", (VISU_HEADER_KEY, dump_visu_header(VisuHeader(values=[{"datapoint_id": DP}])))
    )
    devices = [{"slug": "panel", "name": "Panel", "header": {"values": [{"datapoint_id": DP2}]}}, {"slug": "handy", "name": "Handy"}]
    await db.execute_and_commit("INSERT INTO app_settings (key, value) VALUES (?, ?)", (VISU_DEVICES_KEY, json.dumps(devices)))
    assert await header_datapoint_ids(db) == {DP, DP2}


async def test_default_header_get_and_put(db):
    assert await get_visu_header(db=db) == VisuHeader()

    body = VisuHeader(sticky=True, show_breadcrumb=False, menu_page_id="menu", menu_label="Menü", show_clock=True, values=[{"datapoint_id": DP}])
    assert await update_visu_header(body=body, request=_request(), db=db, _admin="admin") == body

    assert await get_visu_header(db=db) == body
    audit = await db.fetchone("SELECT * FROM audit_log_entries WHERE action = 'system.visu_header.updated'")
    assert (audit["actor"], audit["resource_type"], audit["resource_id"]) == ("admin", "visu_header", "global")


@pytest.mark.parametrize(
    ("header", "detail"),
    [
        (VisuHeader(menu_page_id="gone"), "Unknown menu page: gone"),
        (VisuHeader(values=[{"datapoint_id": "33333333-3333-3333-3333-333333333333"}]), "Unknown datapoint: 33333333-3333-3333-3333-333333333333"),
    ],
)
async def test_put_rejects_unknown_references(db, header, detail):
    with pytest.raises(HTTPException) as exc:
        await update_visu_header(body=header, request=_request(), db=db, _admin="admin")
    assert (exc.value.status_code, exc.value.detail) == (422, detail)

    with pytest.raises(HTTPException) as exc:
        await update_visu_devices(
            body=VisuDevicesIn(devices=[{"slug": "panel", "name": "Panel", "header": header.model_dump()}]),
            request=_request("/api/v1/system/visu-devices"),
            db=db,
            _admin="admin",
        )
    assert exc.value.detail == detail


async def test_device_header_is_stored_with_the_profile(db):
    body = VisuDevicesIn(devices=[{"slug": "panel", "name": "Panel", "header": {"menu_page_id": "menu", "values": [{"datapoint_id": DP2}]}}])
    result = await update_visu_devices(body=body, request=_request("/api/v1/system/visu-devices"), db=db, _admin="admin")
    assert result[0].header.menu_page_id == "menu"
    assert await header_datapoint_ids(db) == {DP2}


# ── Live channel: header datapoints join the page scope ───────────────────────


class _FakeWebSocket:
    def __init__(self, *, headers=None, query_params=None, received=None) -> None:
        self.headers = headers or {}
        self.query_params = query_params or {}
        self.scope = {"subprotocols": []}
        self.received = received or []
        self.sent: list[dict] = []
        self.close_calls: list = []

    async def accept(self, subprotocol=None) -> None:
        return None

    async def close(self, code=None, reason=None) -> None:
        self.close_calls.append((code, reason))

    async def receive_json(self) -> dict:
        if self.received:
            return self.received.pop(0)
        raise WebSocketDisconnect()

    async def send_json(self, msg: dict) -> None:
        self.sent.append(msg)


class _Db:
    def __init__(self, *, is_admin: bool = False) -> None:
        self.is_admin = is_admin

    async def fetchone(self, query: str, _params: tuple = ()):
        if "FROM users" in query:
            return {"is_admin": int(self.is_admin)}
        if "FROM visu_nodes" in query:
            return {"type": "PAGE"}
        return None

    async def fetchall(self, query: str, _params: tuple = ()):
        return []


async def _public(_db, node_id):
    return "public", node_id


async def _subscribe(monkeypatch, ws: _FakeWebSocket, db: _Db) -> list[dict]:
    monkeypatch.setattr(ws_api, "get_db", lambda: db)
    monkeypatch.setattr(ws_api, "_page_allowed_datapoints", AsyncMock(return_value={"page-dp"}))
    monkeypatch.setattr(ws_api, "header_datapoint_ids", AsyncMock(return_value={"header-dp"}))
    monkeypatch.setattr("obs.api.v1.visu._resolve_access_with_node", _public)
    ws_api.init_ws_manager()
    try:
        await ws_api.websocket_endpoint(ws)
    finally:
        ws_api.reset_ws_manager()
    return ws.sent


async def test_anonymous_page_connection_may_subscribe_header_values(monkeypatch):
    ws = _FakeWebSocket(query_params={"page_id": "page-public"}, received=[{"action": "subscribe", "ids": ["page-dp", "header-dp", "other-dp"]}])
    sent = await _subscribe(monkeypatch, ws, _Db())
    assert sent == [{"action": "subscribed", "ids": ["page-dp", "header-dp"]}]


async def test_signed_in_page_connection_may_subscribe_header_values(monkeypatch):
    def _decode(token: str, expected_type: str = "access") -> str:
        return "alice"

    async def _nothing_authorized(_db, _principal, _ids, *, action):
        return []

    monkeypatch.setattr(auth_api, "decode_token", _decode)
    monkeypatch.setattr(ws_api, "filter_authorized_datapoints", _nothing_authorized)
    ws = _FakeWebSocket(
        headers={"authorization": "Bearer valid.jwt.token"},
        query_params={"page_id": "page-public"},
        received=[{"action": "subscribe", "ids": ["header-dp", "other-dp"]}],
    )
    sent = await _subscribe(monkeypatch, ws, _Db())
    assert sent == [{"action": "subscribed", "ids": ["header-dp"]}]
