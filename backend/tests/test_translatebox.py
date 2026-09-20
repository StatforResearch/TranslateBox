"""Backend tests for TranslateBox Live API (with live OPENAI_API_KEY)."""
import os
import re
import json
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def test_health_returns_200_and_key_configured():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"
    assert data.get("openai_key_configured") is True
    assert data.get("model") == "gpt-realtime-translate"


def test_realtime_session_mints_ephemeral():
    r = requests.post(f"{BASE_URL}/api/realtime-session", json={"target_language": "en"}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    # Ensure no permanent key anywhere
    raw = json.dumps(body)
    assert "sk-" not in raw, "Permanent sk- key leaked into response!"
    # Expected fields
    val = body.get("value")
    assert isinstance(val, str) and val.startswith("ek_"), f"expected ek_ prefix, got: {val[:8] if val else None}"
    assert body.get("expires_at") is not None
    session = body.get("session", {})
    assert session.get("type") == "translation", f"unexpected session.type={session.get('type')}"


def test_root_api():
    r = requests.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---- Multi-language target support ----

def _post_session(target):
    return requests.post(f"{BASE_URL}/api/realtime-session", json={"target_language": target}, timeout=30)


def test_realtime_session_target_es():
    r = _post_session("es")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("value", "").startswith("ek_")
    assert body["session"]["audio"]["output"]["language"] == "es"


def test_realtime_session_target_de():
    r = _post_session("de")
    assert r.status_code == 200, r.text
    assert r.json()["session"]["audio"]["output"]["language"] == "de"


def test_realtime_session_target_ja():
    r = _post_session("ja")
    assert r.status_code == 200, r.text
    assert r.json()["session"]["audio"]["output"]["language"] == "ja"


def test_realtime_session_unsupported_target_returns_400():
    r = _post_session("xx")
    assert r.status_code == 400
    detail = r.json().get("detail", "")
    # Should mention supported list
    for code in ("en", "es", "fr", "de"):
        assert code in detail


def test_realtime_session_case_insensitive_target():
    r = _post_session("FR")
    assert r.status_code == 200, r.text
    assert r.json()["session"]["audio"]["output"]["language"] == "fr"


# ---- V0.5 upgrade: FR<->EN + instructions + security ----

def test_v05_target_en_mints():
    r = requests.post(f"{BASE_URL}/api/realtime-session", json={"target_language": "en"}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["value"].startswith("ek_")
    assert body["session"]["audio"]["output"]["language"] == "en"
    assert "sk-" not in json.dumps(body)


def test_v05_target_fr_mints():
    r = requests.post(f"{BASE_URL}/api/realtime-session", json={"target_language": "fr"}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["value"].startswith("ek_")
    assert body["session"]["audio"]["output"]["language"] == "fr"
    assert "sk-" not in json.dumps(body)


def test_v05_instructions_graceful_fallback():
    """Non-empty instructions must still mint a session and include instructions_applied bool."""
    payload = {
        "target_language": "en",
        "instructions": "You are a sermon interpreter. Vocab: Holy Spirit, Kingdom of God. Event: Sunday Service.",
    }
    r = requests.post(f"{BASE_URL}/api/realtime-session", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["value"].startswith("ek_")
    assert "instructions_applied" in body
    assert isinstance(body["instructions_applied"], bool)
    assert "sk-" not in json.dumps(body)


def test_v05_health_no_key_leak():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    assert "sk-" not in json.dumps(r.json())
