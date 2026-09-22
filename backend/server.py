from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import asyncio
import json
import secrets
import time
import logging
import hashlib
from collections import defaultdict, deque
from pathlib import Path
from pydantic import BaseModel, Field
import httpx
import anyio
from event_store import EventStore


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# OpenAI Realtime Translation configuration
OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/translations/client_secrets"
REALTIME_MODEL = os.environ.get("OPENAI_REALTIME_MODEL", "gpt-realtime-translate")
INPUT_TRANSCRIPTION_MODEL = "gpt-realtime-whisper"

# The 13 output languages supported by gpt-realtime-translate.
SUPPORTED_OUTPUT_LANGUAGES = {
    "en", "es", "pt", "fr", "ja", "ru", "zh", "de", "ko", "hi", "id", "vi", "it",
}

# Abuse controls for operator sessions and public listener connections.
MAX_INSTRUCTIONS_LEN = int(os.environ.get("MAX_INSTRUCTIONS_LEN", "6000"))
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", "32768"))  # 32 KB
RATE_LIMIT_MAX = int(os.environ.get("SESSION_RATE_LIMIT_MAX", "20"))
RATE_LIMIT_WINDOW = int(os.environ.get("SESSION_RATE_LIMIT_WINDOW", "60"))  # seconds
_rate_buckets = defaultdict(deque)


def _client_ip(request: Request) -> str:
    # Only Uvicorn may resolve forwarding headers, from trusted proxies.
    return request.client.host if request.client else "unknown"


def _rate_limited(ip: str, maximum: int = RATE_LIMIT_MAX) -> bool:
    now = time.monotonic()
    for key, entries in list(_rate_buckets.items()):
        if not entries or now - entries[-1] > RATE_LIMIT_WINDOW:
            del _rate_buckets[key]
    if ip not in _rate_buckets and len(_rate_buckets) >= 10000:
        return True
    bucket = _rate_buckets[ip]
    while bucket and now - bucket[0] > RATE_LIMIT_WINDOW:
        bucket.popleft()
    if len(bucket) >= maximum:
        return True
    bucket.append(now)
    return False

app = FastAPI(title="TranslateBox Live API", docs_url=None, redoc_url=None)


def require_operator(request: Request):
    if _rate_limited("auth:" + _client_ip(request), 120):
        raise HTTPException(429, "Too many requests. Try again shortly.")
    expected = os.environ.get("OPERATOR_TOKEN", "")
    if len(expected) < 32:
        raise HTTPException(503, "Operator access is not configured on the server.")
    supplied = request.headers.get("authorization", "")
    if not secrets.compare_digest(supplied.encode(), ("Bearer " + expected).encode()):
        raise HTTPException(401, "Operator access required.")

api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("translatebox")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response




class BodyLimitMiddleware:
    """Count actual bytes before FastAPI parses JSON, including chunked bodies."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > MAX_BODY_BYTES:
                return await JSONResponse({"detail": "Request body too large."}, 413)(scope, receive, send)
            chunks.append(message.get("body", b""))
            if not message.get("more_body", False):
                break
        delivered = False
        async def replay():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
        await self.app(scope, replay, send)


class SessionRequest(BaseModel):
    target_language: str = Field(default="en", max_length=10)
    instructions: str | None = Field(default=None, max_length=MAX_INSTRUCTIONS_LEN)


@api_router.get("/")
async def root():
    return {"message": "TranslateBox Live API", "status": "ok"}


@api_router.get("/operator", dependencies=[Depends(require_operator)])
async def operator_access():
    return {"status": "ok"}


@api_router.get("/health")
async def health():
    return {
        "status": "ok",
        "openai_key_configured": bool(os.environ.get("OPENAI_API_KEY")),
        "model": REALTIME_MODEL,
    }


def _enforce_session_abuse_controls(request: Request):
    """Additional session-minting rate limit."""
    if _rate_limited(_client_ip(request)):
        raise HTTPException(
            status_code=429,
            detail="Too many session requests. Please wait a moment and try again.",
        )
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Request body too large.")


def _resolve_target_language(target_language: str) -> str:
    """Validate the requested output language against the model's supported set."""
    lang = (target_language or "en").lower()
    if lang not in SUPPORTED_OUTPUT_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target language '{lang}'. Supported output languages: {sorted(SUPPORTED_OUTPUT_LANGUAGES)}",
        )
    return lang


def _build_session_config(target_language: str) -> dict:
    return {
        "session": {
            "model": REALTIME_MODEL,
            "audio": {
                "input": {
                    "transcription": {"model": INPUT_TRANSCRIPTION_MODEL},
                    "noise_reduction": {"type": "near_field"},
                },
                "output": {"language": target_language},
            },
        }
    }


def _openai_headers(api_key: str) -> dict:
    # Bind the ephemeral secret to a stable, non-identifying operator hash.
    safety_id = hashlib.sha256(b"translatebox-live-operator").hexdigest()
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safety_id,
    }


async def _mint_session(base_config: dict, instructions: str, headers: dict):
    """POST to OpenAI, attaching custom instructions when possible.

    gpt-realtime-translate may reject the `instructions` field, so we attempt it
    then gracefully fall back to the proven base config. Returns (resp, applied).
    """
    async def _post(config):
        async with httpx.AsyncClient(timeout=20.0) as client:
            return await client.post(OPENAI_CLIENT_SECRETS_URL, headers=headers, json=config)

    if not instructions:
        return await _post(base_config), False

    with_instr = {"session": {**base_config["session"], "instructions": instructions}}
    resp = await _post(with_instr)
    if resp.status_code < 400:
        return resp, True
    if resp.status_code not in (400, 422):
        return resp, False
    logger.warning("Instructions not accepted by model (%s); retrying without them.", resp.status_code)
    return await _post(base_config), False


@api_router.post("/realtime-session", dependencies=[Depends(require_operator)])
async def create_realtime_session(req: SessionRequest, request: Request):
    """Mint a short-lived OpenAI Realtime Translation client secret.

    The permanent OPENAI_API_KEY never leaves the server. The browser only
    receives the ephemeral `value` used to open a WebRTC translation call.
    """
    _enforce_session_abuse_controls(request)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="The translation service is not configured on the server.",
        )

    target_language = _resolve_target_language(req.target_language)
    session_config = _build_session_config(target_language)
    headers = _openai_headers(api_key)
    instructions = (req.instructions or "").strip()[:MAX_INSTRUCTIONS_LEN]

    try:
        resp, instructions_applied = await _mint_session(session_config, instructions, headers)
    except httpx.RequestError as exc:
        logger.error("Network error reaching translation service: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="The translation service could not start a session. Try again shortly.")

    if resp.status_code >= 400:
        # Log only status: upstream bodies may contain sensitive information.
        logger.error("OpenAI session error %s", resp.status_code)
        try:
            upstream_code = resp.json().get("error", {}).get("code")
        except (ValueError, AttributeError):
            upstream_code = None
        if resp.status_code == 401:
            detail = "The server OpenAI key is invalid. Ask the administrator to replace it and restart the backend."
            status = 502
        elif resp.status_code == 403:
            detail = "The server OpenAI project cannot access this translation model. Ask the administrator to check project permissions."
            status = 502
        elif resp.status_code == 402 or upstream_code == "insufficient_quota":
            detail = "The OpenAI project has insufficient credit or quota. Ask the administrator to check billing and usage limits."
            status = 402
        elif resp.status_code == 429:
            detail = "The translation service is receiving too many requests. Wait one minute before restarting."
            status = 429
        else:
            detail = "The translation service is temporarily unavailable. Try again shortly."
            status = 502
        raise HTTPException(status_code=status, detail=detail)

    logger.info(
        "Minted ephemeral translation session (model=%s, target=%s, instructions_applied=%s)",
        REALTIME_MODEL, target_language, instructions_applied,
    )
    try:
        data = resp.json()
        value = data.get("value") or data.get("client_secret", {}).get("value")
        if not isinstance(value, str) or not value.startswith("ek_"):
            raise ValueError("Invalid client secret")
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(502, "Invalid translation service response. Try again shortly.")
    return JSONResponse(content={
        "value": value, "expires_at": data.get("expires_at"),
        "instructions_applied": instructions_applied,
    }, headers={"Cache-Control": "no-store"})


# ==========================================================================
# V1 — Multi-listener broadcast (ONE OpenAI session -> many listeners)
# ==========================================================================
from fastapi import WebSocket, WebSocketDisconnect

MAX_LISTENERS = int(os.environ.get("MAX_LISTENERS", "30"))
MAX_EVENTS = int(os.environ.get("MAX_EVENTS", "100"))
EVENT_TTL = int(os.environ.get("EVENT_TTL_SECONDS", "86400"))
EVENTS = EventStore(os.environ.get("EVENTS_DB_PATH", str(ROOT_DIR / "data" / "events.sqlite3")))
ROOMS = {}    # event_id -> {"operator": ws|None, "listeners": set(), "init": bytes|None}


def _room(eid):
    return ROOMS.setdefault(eid, {"operator": None, "listeners": set(), "init": None})


class EventCreate(BaseModel):
    name: str = Field(default="Live Interpretation", max_length=200)
    organization: str = Field(default="", max_length=200)
    target_language: str = Field(default="en", max_length=10)
    pin: str | None = Field(default=None, max_length=64)
    captions: bool = False


def _prune_events():
    for eid, event in list(EVENTS.items()):
        room = ROOMS.get(eid, {})
        if time.time() - event["created"] > EVENT_TTL and not room.get("operator") and not room.get("listeners"):
            EVENTS.pop(eid, None)
            ROOMS.pop(eid, None)


@api_router.post("/events", dependencies=[Depends(require_operator)])
async def create_event(body: EventCreate):
    _prune_events()
    if len(EVENTS) >= MAX_EVENTS:
        raise HTTPException(429, "Event capacity reached. Try again later.")
    target = _resolve_target_language(body.target_language)
    eid = secrets.token_urlsafe(12)
    token = secrets.token_urlsafe(32)
    EVENTS[eid] = {
        "name": body.name or "Live Interpretation",
        "organization": body.organization or "",
        "target": target,
        "operator_token_hash": hashlib.sha256(token.encode()).hexdigest(),
        "pin_hash": hashlib.sha256(body.pin.encode()).hexdigest() if body.pin else None,
        "captions": bool(body.captions),
        "created": time.time(),
    }
    _room(eid)
    logger.info("Event created %s", eid)
    return JSONResponse({"id": eid, "path": f"/e/{eid}", "operator_token": token, **_public_event(eid)}, headers={"Cache-Control": "no-store"})


def _public_event(eid):
    ev = EVENTS.get(eid)
    if not ev:
        return None
    room = ROOMS.get(eid, {})
    return {
        "name": ev["name"], "organization": ev["organization"], "target": ev["target"],
        "captions": ev["captions"], "pin_protected": ev["pin_hash"] is not None,
        "live": bool(room.get("operator")), "listeners": len(room.get("listeners", [])),
        "max_listeners": MAX_LISTENERS,
        "created": ev["created"],
        "expires_at": ev["created"] + EVENT_TTL,
    }


@api_router.get("/events", dependencies=[Depends(require_operator)])
async def list_events():
    _prune_events()
    return {"events": [{"id": eid, **_public_event(eid)} for eid in sorted(EVENTS, key=lambda eid: EVENTS[eid]["created"], reverse=True)]}


@api_router.post("/events/{eid}/resume", dependencies=[Depends(require_operator)])
async def resume_event(eid: str):
    _prune_events()
    if eid not in EVENTS:
        raise HTTPException(404, "Event expired or not found. Create a new event.")
    if _room(eid)["operator"] is not None:
        raise HTTPException(409, "This event is already broadcasting in another tab. Stop it there before resuming.")
    token = secrets.token_urlsafe(32)
    EVENTS[eid] = {**EVENTS[eid], "operator_token_hash": hashlib.sha256(token.encode()).hexdigest()}
    return JSONResponse({"id": eid, "path": f"/e/{eid}", "operator_token": token, **_public_event(eid)}, headers={"Cache-Control": "no-store"})


@api_router.get("/events/{eid}")
async def get_event(eid: str):
    _prune_events()
    info = _public_event(eid)
    if not info:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"id": eid, **info}


def _check_pin(eid, pin):
    ev = EVENTS.get(eid)
    if not ev or ev["pin_hash"] is None:
        return True
    return pin is not None and hashlib.sha256(pin.encode()).hexdigest() == ev["pin_hash"]


@api_router.get("/stats", dependencies=[Depends(require_operator)])
async def stats():
    import psutil
    return {
        "cpu_percent": psutil.cpu_percent(interval=None),
        "ram_percent": psutil.virtual_memory().percent,
        "openai_sessions": sum(bool(r.get("operator")) for r in ROOMS.values()),
        "total_listeners": sum(len(r["listeners"]) for r in ROOMS.values()),
        "events": [{"id": eid, "listeners": len(r["listeners"]), "live": bool(r["operator"])} for eid, r in ROOMS.items()],
        "max_listeners": MAX_LISTENERS,
    }


async def _notify_operator(eid):
    room = _room(eid)
    if room["operator"]:
        try:
            await asyncio.wait_for(room["operator"].send_json({"type": "listeners", "count": len(room["listeners"])}), timeout=2)
        except Exception:
            pass


async def _broadcast_status(eid, live):
    room = _room(eid)
    await _fanout(room, "send_json", {"type": "status", "live": live})

async def _fanout(room, method, data):
    async def deliver(listener):
        try:
            await asyncio.wait_for(getattr(listener, method)(data), timeout=2)
        except Exception:
            room["listeners"].discard(listener)
            try:
                await asyncio.wait_for(listener.close(code=1013), timeout=1)
            except Exception:
                pass
    await asyncio.gather(*(deliver(listener) for listener in list(room["listeners"])))


async def _run_operator(websocket: WebSocket, eid: str, room):
    room["operator"] = websocket
    room["init"] = None
    try:
        await websocket.send_json({"type": "ready"})
        await _broadcast_status(eid, True)
        await _notify_operator(eid)
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if msg.get("bytes") is not None:
                data = msg["bytes"]
                if len(data) > 262144:
                    await websocket.close(code=1009)
                    break
                if room["init"] is None:
                    room["init"] = data  # cache init/header segment for late joiners
                await _fanout(room, "send_bytes", data)
            elif msg.get("text") is not None:
                try:
                    caption = json.loads(msg["text"])
                    if caption.get("type") == "caption" and isinstance(caption.get("text"), str):
                        enabled = bool(caption["text"])
                        if EVENTS[eid]["captions"] != enabled:
                            EVENTS[eid] = {**EVENTS[eid], "captions": enabled}
                        await _fanout(room, "send_json", {"type": "caption", "text": caption["text"][-6000:]})
                except (ValueError, AttributeError):
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        room["operator"] = None
        room["init"] = None
        with anyio.CancelScope(shield=True):
            await _broadcast_status(eid, False)


async def _run_listener(websocket: WebSocket, eid: str, room, pin):
    if not _check_pin(eid, pin):
        await websocket.close(code=4401)
        return
    if len(room["listeners"]) >= MAX_LISTENERS:
        await websocket.close(code=4429)
        return
    room["listeners"].add(websocket)
    await _notify_operator(eid)
    try:
        await websocket.send_json({"type": "status", "live": bool(room["operator"])})
        if room["init"]:
            await websocket.send_bytes(room["init"])
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    finally:
        room["listeners"].discard(websocket)
        await _notify_operator(eid)


@app.websocket("/api/ws/{eid}")
async def ws_broadcast(websocket: WebSocket, eid: str, role: str = "listener"):
    _prune_events()
    if eid not in EVENTS:
        await websocket.accept()
        await websocket.close(code=4404)
        return
    await websocket.accept()
    origin = websocket.headers.get("origin")
    if origin and origin not in _cors_origins:
        await websocket.close(code=4403)
        return
    if _rate_limited("ws:" + _client_ip(websocket), 120):
        await websocket.close(code=4429)
        return
    room = _room(eid)
    try:
        auth = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        if not isinstance(auth, dict):
            raise ValueError("Invalid authentication")
    except WebSocketDisconnect:
        return
    except (asyncio.TimeoutError, ValueError, KeyError):
        await websocket.close(code=4401)
        return
    if eid not in EVENTS:
        await websocket.close(code=4404)
        return
    if role == "operator":
        token = auth.get("token", "")
        if not isinstance(token, str) or not secrets.compare_digest(hashlib.sha256(token.encode()).hexdigest(), EVENTS[eid]["operator_token_hash"]):
            await websocket.close(code=4401)
            return
        if room["operator"] is not None:
            await websocket.close(code=4409)
            return
        # Reserve before any await to prevent simultaneous operator takeover.
        room["operator"] = websocket
        await _run_operator(websocket, eid, room)
    elif role == "listener":
        pin = auth.get("pin")
        if pin is not None and not isinstance(pin, str):
            await websocket.close(code=4401)
            return
        await _run_listener(websocket, eid, room, pin)
    else:
        await websocket.close(code=4400)


app.include_router(api_router)

app.add_middleware(BodyLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# Authentication uses explicit bearer headers, not browser cookies.
_cors_origins = [o.strip().rstrip('/') for o in os.environ.get('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
