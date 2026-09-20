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
