from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import time
import logging
import hashlib
from collections import defaultdict, deque
from pathlib import Path
from pydantic import BaseModel
import httpx


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

# Abuse controls for the (unauthenticated by design) session-minting endpoint.
MAX_INSTRUCTIONS_LEN = int(os.environ.get("MAX_INSTRUCTIONS_LEN", "6000"))
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", "32768"))  # 32 KB
RATE_LIMIT_MAX = int(os.environ.get("SESSION_RATE_LIMIT_MAX", "20"))
RATE_LIMIT_WINDOW = int(os.environ.get("SESSION_RATE_LIMIT_WINDOW", "60"))  # seconds
_rate_buckets = defaultdict(deque)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limited(ip: str) -> bool:
    now = time.monotonic()
    bucket = _rate_buckets[ip]
    while bucket and now - bucket[0] > RATE_LIMIT_WINDOW:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT_MAX:
        return True
    bucket.append(now)
    return False

app = FastAPI(title="TranslateBox Live API")
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




class SessionRequest(BaseModel):
    target_language: str = "en"
    instructions: str | None = None


@api_router.get("/")
async def root():
    return {"message": "TranslateBox Live API", "status": "ok"}


@api_router.get("/health")
async def health():
    return {
        "status": "ok",
        "openai_key_configured": bool(os.environ.get("OPENAI_API_KEY")),
        "model": REALTIME_MODEL,
    }


@api_router.post("/realtime-session")
async def create_realtime_session(req: SessionRequest, request: Request):
    """Mint a short-lived OpenAI Realtime Translation client secret.

    The permanent OPENAI_API_KEY never leaves the server. The browser only
    receives the ephemeral `value` used to open a WebRTC translation call.
    """
    # Abuse controls (endpoint is unauthenticated by design for the operator prototype).
    ip = _client_ip(request)
    if _rate_limited(ip):
        raise HTTPException(
            status_code=429,
            detail="Too many session requests. Please wait a moment and try again.",
        )
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Request body too large.")

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured on the server. Add it to backend/.env and restart the backend.",
        )

    target_language = (req.target_language or "en").lower()
    if target_language not in SUPPORTED_OUTPUT_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target language '{target_language}'. Supported output languages: {sorted(SUPPORTED_OUTPUT_LANGUAGES)}",
        )

    session_config = {
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

    # Bind the ephemeral secret to a stable, non-identifying operator hash.
    safety_id = hashlib.sha256(b"translatebox-live-operator").hexdigest()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safety_id,
    }

    instructions = (req.instructions or "").strip()[:MAX_INSTRUCTIONS_LEN]

    async def _mint(config):
        async with httpx.AsyncClient(timeout=20.0) as client:
            return await client.post(OPENAI_CLIENT_SECRETS_URL, headers=headers, json=config)

    try:
        instructions_applied = False
        if instructions:
            # gpt-realtime-translate may not accept custom instructions. Attempt
            # to attach them, and gracefully fall back to the proven base config
            # if OpenAI rejects the field, so the working flow is never broken.
            with_instr = {
                "session": {
                    **session_config["session"],
                    "instructions": instructions,
                }
            }
            resp = await _mint(with_instr)
            if resp.status_code < 400:
                instructions_applied = True
            else:
                logger.warning(
                    "Instructions not accepted by model (%s); retrying without them.",
                    resp.status_code,
                )
                resp = await _mint(session_config)
        else:
            resp = await _mint(session_config)
    except httpx.RequestError as exc:
        logger.error("Network error reaching OpenAI: %s", exc)
        raise HTTPException(status_code=502, detail=f"Failed to reach OpenAI: {exc}")

    if resp.status_code >= 400:
        # Log full upstream detail server-side; return a generic message to the client
        # to avoid leaking upstream/internal information.
        logger.error("OpenAI session error %s: %s", resp.status_code, resp.text)
        status = resp.status_code if resp.status_code in (429, 401, 402, 403) else 502
        raise HTTPException(
            status_code=status,
            detail="The translation service could not start a session right now. Please try again shortly.",
        )

    logger.info(
        "Minted ephemeral translation session (model=%s, target=%s, instructions_applied=%s)",
        REALTIME_MODEL, target_language, instructions_applied,
    )
    payload = resp.json()
    payload["instructions_applied"] = instructions_applied
    return JSONResponse(content=payload)


app.include_router(api_router)

app.add_middleware(SecurityHeadersMiddleware)

# App uses no cookies/auth, so credentials are disabled (avoids the invalid
# wildcard-origin + credentials combination flagged in the security audit).
_cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
