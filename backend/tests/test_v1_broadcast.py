"""V1 Multi-listener broadcast tests: events + WS hub + single-session guarantee + limits."""
import os
import json
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
# Use internal localhost for WS to avoid ingress WS quirks; API calls stay on public URL.
WS_INTERNAL = "ws://localhost:8001"
# Derived public WS (wss)
WS_PUBLIC = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")


# ---------------- Events REST ----------------

def _create_event(name="TEST_event", org="TEST_org", pin=None, captions=False):
    body = {"name": name, "organization": org, "target_language": "en", "captions": captions}
    if pin is not None:
        body["pin"] = pin
    r = requests.post(f"{BASE_URL}/api/events", json=body, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_create_event_returns_id_and_path():
    ev = _create_event(name="TEST_create", org="Acme")
    assert isinstance(ev.get("id"), str) and len(ev["id"]) >= 6
    assert ev["path"] == f"/e/{ev['id']}"
    assert ev["name"] == "TEST_create"
    assert ev["organization"] == "Acme"
    assert ev["target"] == "en"
    assert ev["pin_protected"] is False
    assert ev["live"] is False
    assert ev["listeners"] == 0
    # no key leak
    assert "sk-" not in json.dumps(ev)


def test_get_event_public_info_and_404():
    ev = _create_event(name="TEST_get", pin="1234", captions=True)
    r = requests.get(f"{BASE_URL}/api/events/{ev['id']}", timeout=15)
    assert r.status_code == 200
    info = r.json()
    assert info["id"] == ev["id"]
    assert info["pin_protected"] is True
    assert info["captions"] is True
    assert info["name"] == "TEST_get"

    r404 = requests.get(f"{BASE_URL}/api/events/does-not-exist-xyz", timeout=15)
    assert r404.status_code == 404


def test_stats_shape():
    r = requests.get(f"{BASE_URL}/api/stats", timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("cpu_percent", "ram_percent", "openai_sessions", "total_listeners", "max_listeners"):
        assert k in d, f"missing {k}"
    assert d["max_listeners"] == 30
    assert "sk-" not in json.dumps(d)


# ---------------- WS single-session + fan-out ----------------

def _ws(eid, role="listener", pin=None, base=WS_INTERNAL):
    q = f"role={role}"
    if pin is not None:
        q += f"&pin={pin}"
    return websockets.connect(f"{base}/api/ws/{eid}?{q}", open_timeout=10, close_timeout=5)


def _run(coro):
    return asyncio.run(coro)


async def _fanout_impl():
    ev = _create_event(name="TEST_fanout")
    eid = ev["id"]

    # Operator connects
    async with _ws(eid, role="operator") as op:
        # Listener 1 connects, receives status live:true
        l1 = await _ws(eid, role="listener").__aenter__()
        msg1 = await asyncio.wait_for(l1.recv(), timeout=5)
        assert isinstance(msg1, str)
        j1 = json.loads(msg1)
        assert j1["type"] == "status" and j1["live"] is True

        # Operator sends init binary chunk
        init_chunk = b"INITHEADER-\x00\x01\x02" + b"a" * 32
        await op.send(init_chunk)

        # Listener 1 receives it
        got1 = await asyncio.wait_for(l1.recv(), timeout=5)
        assert isinstance(got1, (bytes, bytearray)) and bytes(got1) == init_chunk

        # Second binary chunk (payload)
        payload = b"PAYLOAD-" + b"b" * 64
        await op.send(payload)
        got1b = await asyncio.wait_for(l1.recv(), timeout=5)
        assert bytes(got1b) == payload

        # Late joiner - should get status THEN cached init chunk (which was first bytes)
        l2 = await _ws(eid, role="listener").__aenter__()
        m2a = await asyncio.wait_for(l2.recv(), timeout=5)
        assert json.loads(m2a)["live"] is True
        m2b = await asyncio.wait_for(l2.recv(), timeout=5)
        assert bytes(m2b) == init_chunk, "late joiner should get cached init chunk"

        # Text (caption) from operator relays to all listeners
        caption = json.dumps({"type": "caption", "text": "hello world"})
        await op.send(caption)
        c1 = await asyncio.wait_for(l1.recv(), timeout=5)
        c2 = await asyncio.wait_for(l2.recv(), timeout=5)
        assert json.loads(c1)["text"] == "hello world"
        assert json.loads(c2)["text"] == "hello world"

        # /api/stats: openai_sessions == 1 regardless of listener count
        stats = requests.get(f"{BASE_URL}/api/stats", timeout=15).json()
        assert stats["openai_sessions"] == 1, stats
        # find our event's listener count
        our = next((e for e in stats["events"] if e["id"] == eid), None)
        assert our and our["listeners"] == 2

        await l1.close()
        await l2.close()

    # After op disconnects, stats openai_sessions should drop for this event
    await asyncio.sleep(0.3)
    stats2 = requests.get(f"{BASE_URL}/api/stats", timeout=15).json()
    our2 = next((e for e in stats2["events"] if e["id"] == eid), None)
    if our2:
        assert our2["live"] is False


def test_ws_fanout_and_single_session_and_late_joiner():
    _run(_fanout_impl())


async def _pin_impl():
    ev = _create_event(name="TEST_pin", pin="s3cret")
    eid = ev["id"]

    # Wrong pin -> close 4401
    with pytest.raises(websockets.exceptions.ConnectionClosed) as exc:
        async with _ws(eid, role="listener", pin="wrong") as l:
            await l.recv()
    assert exc.value.code == 4401

    # No pin -> close 4401
    with pytest.raises(websockets.exceptions.ConnectionClosed) as exc2:
        async with _ws(eid, role="listener") as l:
            await l.recv()
    assert exc2.value.code == 4401

    # Correct pin connects
    async with _ws(eid, role="listener", pin="s3cret") as l:
        msg = await asyncio.wait_for(l.recv(), timeout=5)
        assert json.loads(msg)["type"] == "status"


def test_ws_pin_gating():
    _run(_pin_impl())


async def _unknown_impl():
    # Server closes before accept -> either close code 4404 (post-accept) or
    # InvalidStatus HTTP rejection (pre-accept). Both indicate rejection but only
    # 4404 is what browser JS onclose can observe cleanly.
    try:
        async with _ws("nonexistent-abc123", role="listener") as l:
            await l.recv()
        raise AssertionError("expected connection to be rejected")
    except websockets.exceptions.ConnectionClosed as e:
        assert e.code == 4404, f"expected 4404, got {e.code}"
    except websockets.exceptions.InvalidStatus as e:
        # Server closed before accept: acceptable but non-ideal (browser sees 1006).
        assert e.response.status_code in (403, 404), f"unexpected HTTP status {e.response.status_code}"


def test_ws_unknown_event_4404():
    _run(_unknown_impl())


async def _limit_impl():
    ev = _create_event(name="TEST_limit")
    eid = ev["id"]
    conns = []
    try:
        for i in range(30):
            c = await _ws(eid, role="listener").__aenter__()
            await asyncio.wait_for(c.recv(), timeout=5)
            conns.append(c)
        with pytest.raises(websockets.exceptions.ConnectionClosed) as exc:
            async with _ws(eid, role="listener") as l:
                await l.recv()
        assert exc.value.code == 4429
    finally:
        for c in conns:
            try:
                await c.close()
            except Exception:
                pass


def test_ws_listener_limit_4429():
    _run(_limit_impl())


# ---------------- No secret leakage ----------------

def test_no_sk_key_leak_in_events_or_stats():
    ev = _create_event(name="TEST_leak")
    for url in (f"{BASE_URL}/api/events/{ev['id']}", f"{BASE_URL}/api/stats"):
        r = requests.get(url, timeout=15)
        assert "sk-" not in r.text
        assert "sk-" not in " ".join(f"{k}:{v}" for k, v in r.headers.items())
