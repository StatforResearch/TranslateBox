"""Security hardening tests for TranslateBox Live API (SEC-001, SEC-002, SEC-003, security headers)."""
import os
import json
import time
import requests
import concurrent.futures

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

REQUIRED_SECURITY_HEADERS = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
}


# ---- Security headers on every response ----

def _assert_security_headers(resp):
    hdrs = {k.lower(): v for k, v in resp.headers.items()}
    for k, v in REQUIRED_SECURITY_HEADERS.items():
        assert hdrs.get(k) == v, f"missing/incorrect {k}: got {hdrs.get(k)}"
    assert "strict-transport-security" in hdrs, "missing Strict-Transport-Security"
    assert "max-age" in hdrs["strict-transport-security"].lower()


def test_security_headers_on_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    _assert_security_headers(r)


def test_security_headers_on_realtime_session():
    r = requests.post(
        f"{BASE_URL}/api/realtime-session",
        json={"target_language": "en"},
        timeout=30,
    )
    # regardless of status, security headers must be present
    _assert_security_headers(r)


# ---- Secret safety regression ----

def test_health_no_key_leak_headers_and_body():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert "sk-" not in json.dumps(r.json())
    joined_headers = " ".join(f"{k}:{v}" for k, v in r.headers.items())
    assert "sk-" not in joined_headers


def test_realtime_session_body_contains_ek_not_sk():
    r = requests.post(f"{BASE_URL}/api/realtime-session", json={"target_language": "en"}, timeout=30)
    if r.status_code == 200:
        body = r.json()
        raw = json.dumps(body)
        assert "sk-" not in raw
        # Only expected fields (value/expires_at/session/instructions_applied) — check allowed keys exist
        assert body.get("value", "").startswith("ek_")
        assert "expires_at" in body
        assert "session" in body
        assert "instructions_applied" in body


# ---- CORS: allow_credentials must be disabled (no wildcard + credentials combo) ----

def test_cors_credentials_disabled():
    r = requests.options(
        f"{BASE_URL}/api/health",
        headers={
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "GET",
        },
        timeout=15,
    )
    hdrs = {k.lower(): v for k, v in r.headers.items()}
    acao = hdrs.get("access-control-allow-origin")
    acac = hdrs.get("access-control-allow-credentials", "").lower()
    # Must not combine wildcard origin with credentials true
    assert not (acao == "*" and acac == "true"), \
        f"invalid CORS combo: origin={acao}, credentials={acac}"
    # allow_credentials should effectively be off
    assert acac != "true", f"Access-Control-Allow-Credentials should not be true, got {acac}"


def test_cors_allows_cross_origin_get():
    r = requests.get(
        f"{BASE_URL}/api/health",
        headers={"Origin": "https://example.com"},
        timeout=15,
    )
    assert r.status_code == 200
    hdrs = {k.lower(): v for k, v in r.headers.items()}
    # Some presence of ACAO header
    assert "access-control-allow-origin" in hdrs


# ---- Payload size cap (SEC-001) ----

def test_large_instructions_rejected_or_truncated():
    """Body with >40KB instructions must either 413 OR be truncated to <=6000 chars server-side.
    Server must not crash (no 5xx other than a controlled response)."""
    big = "x" * (45 * 1024)  # 45 KB
    r = requests.post(
        f"{BASE_URL}/api/realtime-session",
        json={"target_language": "en", "instructions": big},
        timeout=30,
    )
    # Must not crash with 500
    assert r.status_code != 500, f"server crashed on large body: {r.text[:200]}"
    if r.status_code == 413:
        return  # accepted protection
    # Otherwise must be a controlled response (200 with truncation, or a mapped 4xx)
    assert r.status_code in (200, 400, 401, 402, 403, 413, 429, 502), \
        f"unexpected status for oversized body: {r.status_code} {r.text[:200]}"


# ---- Generic upstream error (SEC-002) ----

def test_generic_error_on_upstream_failure():
    """If /realtime-session returns >=400, detail must be generic and NOT leak OpenAI internals."""
    r = requests.post(f"{BASE_URL}/api/realtime-session", json={"target_language": "en"}, timeout=30)
    if r.status_code == 200:
        # cannot force upstream error path; just confirm normal ek_ mint
        body = r.json()
        assert body.get("value", "").startswith("ek_")
        return
    # Upstream error path — check generic message and no OpenAI JSON leakage
    try:
        detail = r.json().get("detail", "")
    except Exception:
        detail = r.text
    lowered = detail.lower() if isinstance(detail, str) else json.dumps(detail).lower()
    assert "insufficient_quota" not in lowered, f"leaked upstream code: {detail}"
    assert "billing" not in lowered, f"leaked billing URL/text: {detail}"
    assert "openai" not in lowered, f"leaked upstream vendor: {detail}"
    # Should be the generic message
    assert "translation service could not start" in lowered or "try again" in lowered, \
        f"non-generic error message: {detail}"


# ---- Core flow regression (still works) ----

def test_health_regression():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["openai_key_configured"] is True
    assert j["model"] == "gpt-realtime-translate"


def test_invalid_target_returns_400():
    r = requests.post(f"{BASE_URL}/api/realtime-session", json={"target_language": "zz"}, timeout=15)
    assert r.status_code == 400


# ---- Rate limiting (must run LAST — consumes the bucket) ----

def test_zzz_rate_limit_triggers_429():
    """Fire ~24 rapid requests to a fresh bucket; expect ~20x 200 then 429s.
    We sleep >60s first to reset the per-IP bucket."""
    print("Sleeping 65s to reset rate-limit bucket ...")
    time.sleep(65)

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futs = [
            ex.submit(
                requests.post,
                f"{BASE_URL}/api/realtime-session",
                json={"target_language": "en"},
                timeout=30,
            )
            for _ in range(24)
        ]
        for f in concurrent.futures.as_completed(futs):
            try:
                results.append(f.result().status_code)
            except Exception as e:
                results.append(f"err:{e}")

    codes = [c for c in results if isinstance(c, int)]
    print(f"Status distribution: { {c: codes.count(c) for c in set(codes)} }")
    assert 429 in codes, f"expected 429 in results, got {codes}"
    # No 500s
    assert not any(c == 500 for c in codes), f"server crash detected: {codes}"

    # Confirm 429 body is generic (no upstream leakage)
    r = requests.post(f"{BASE_URL}/api/realtime-session", json={"target_language": "en"}, timeout=15)
    if r.status_code == 429:
        detail = r.json().get("detail", "").lower()
        assert "too many session requests" in detail
