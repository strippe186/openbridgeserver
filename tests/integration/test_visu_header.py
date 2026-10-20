"""Integration Tests — Visu header bar.

The header may show datapoint values to every viewer of a Visu page: they are
readable (not writable, no history) with the page context, also without login
and for signed-in users without a grant on the datapoint.
"""

from __future__ import annotations

import uuid

import pytest

from obs.api.auth import create_access_token

pytestmark = pytest.mark.integration


@pytest.fixture
async def reset_header(client, auth_headers):
    yield
    await client.put("/api/v1/system/visu-header", json={}, headers=auth_headers)


async def _setup(client, auth_headers) -> tuple[str, str]:
    dp = await client.post("/api/v1/datapoints/", json={"name": f"Aussen-{uuid.uuid4().hex[:8]}", "data_type": "FLOAT"}, headers=auth_headers)
    assert dp.status_code == 201, dp.text
    dp_id = dp.json()["id"]
    assert (await client.post(f"/api/v1/datapoints/{dp_id}/value", json={"value": 9.7}, headers=auth_headers)).status_code == 204
    page = await client.post(
        "/api/v1/visu/nodes",
        json={"name": f"Seite-{uuid.uuid4().hex[:8]}", "type": "PAGE", "order": 999, "access": "public"},
        headers=auth_headers,
    )
    assert page.status_code == 201, page.text
    return dp_id, page.json()["id"]


async def test_default_header_is_public_and_admin_only_to_change(client, auth_headers, reset_header):
    assert (await client.get("/api/v1/system/visu-header")).json()["show_login"] is True
    assert (await client.put("/api/v1/system/visu-header", json={"show_login": False})).status_code == 401
    resp = await client.put("/api/v1/system/visu-header", json={"show_login": False, "sticky": True}, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert (await client.get("/api/v1/system/visu-header")).json()["sticky"] is True


async def test_header_value_is_readable_on_a_public_page_without_login_but_not_writable(client, auth_headers, reset_header):
    dp_id, page_id = await _setup(client, auth_headers)
    page_ctx = {"X-Page-Id": page_id}

    assert (await client.get(f"/api/v1/datapoints/{dp_id}/value", headers=page_ctx)).status_code == 403

    resp = await client.put("/api/v1/system/visu-header", json={"values": [{"datapoint_id": dp_id, "label": "Außen"}]}, headers=auth_headers)
    assert resp.status_code == 200, resp.text

    value = await client.get(f"/api/v1/datapoints/{dp_id}/value", headers=page_ctx)
    assert value.status_code == 200
    assert value.json()["value"] == 9.7
    assert (await client.get(f"/api/v1/datapoints/{dp_id}/value")).status_code == 401  # still needs a page context
    write = await client.post(f"/api/v1/datapoints/{dp_id}/value", json={"value": 1}, headers=page_ctx)
    assert write.status_code in (401, 403)


async def test_header_value_is_readable_for_a_user_without_grant(client, auth_headers, reset_header):
    dp_id, _page_id = await _setup(client, auth_headers)
    username = f"header-user-{uuid.uuid4().hex[:8]}"
    created = await client.post(
        "/api/v1/auth/users", json={"username": username, "password": "TestPass123!", "is_admin": False}, headers=auth_headers
    )
    assert created.status_code == 201, created.text
    user = {"Authorization": f"Bearer {create_access_token(username)}"}

    assert (await client.get(f"/api/v1/datapoints/{dp_id}/value", headers=user)).status_code == 404
    await client.put("/api/v1/system/visu-header", json={"values": [{"datapoint_id": dp_id}]}, headers=auth_headers)
    assert (await client.get(f"/api/v1/datapoints/{dp_id}/value", headers=user)).status_code == 200
