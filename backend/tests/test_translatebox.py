"""Backend tests for TranslateBox Live API."""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://speech-bridge-48.preview.emergentagent.com").rstrip("/")


def test_health_returns_200_and_key_not_configured():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"
    assert data.get("openai_key_configured") is False
    assert data.get("model") == "gpt-realtime-translate"


def test_realtime_session_returns_503_when_key_missing():
    r = requests.post(f"{BASE_URL}/api/realtime-session", json={"target_language": "en"}, timeout=15)
    assert r.status_code == 503
    body = r.json()
    detail = body.get("detail", "")
    assert "OPENAI_API_KEY" in detail


def test_root_api():
    r = requests.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"
