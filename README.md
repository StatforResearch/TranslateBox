# TranslateBox Live

Real-time spoken-language interpretation for church services, conferences, seminars, meetings and training sessions — optimized for Android tablets, iPad and desktop Chrome/Safari/Edge.

Built on the **OpenAI Realtime Translation API** (`gpt-realtime-translate`) over **WebRTC**. The permanent OpenAI API key stays server-side; the browser only ever receives a short-lived ephemeral session credential.

- **Frontend:** React (CRA + Tailwind + shadcn/ui), installable PWA
- **Backend:** FastAPI — mints ephemeral realtime session secrets
- **Model:** `gpt-realtime-translate` (source auto-detected, target = output language)

---

## Version — V0.5 (Operator prototype)

Directions: **FR → EN** and **EN → FR**. Professional operator dashboard with audio setup + live level meter, event profiles, translation modes, latency & session monitoring, reconnection, transcript export and an experimental tab/screen-audio source. No auth / billing / database / multi-listener yet.

---

## Architecture

```
Browser (React)                         Backend (FastAPI)              OpenAI
──────────────                          ─────────────────              ──────
getUserMedia / getDisplayMedia  ── POST /api/realtime-session ──▶  /v1/realtime/translations/client_secrets
   │  (mic / USB / tab audio)          (uses OPENAI_API_KEY,             │  returns ephemeral "ek_..." secret
   │                                    OpenAI-Safety-Identifier)         │
   ▼                                         ◀── ephemeral value ────────┘
RTCPeerConnection + "oai-events" data channel
   └── POST offer.sdp ───────────────────────────────────────────▶ /v1/realtime/translations/calls
                                      ◀── SDP answer ──────────────────────
   ▶ remote audio track = translated speech (played live)
   ▶ data channel events: session.input_transcript.delta (source),
                          session.output_transcript.delta (translation)
```

The backend never returns the permanent key and never logs it. Event Profile / Mode instructions are compiled client-side, sent to the backend, and attached to the session **with automatic fallback** (retry without) because `gpt-realtime-translate` may not accept custom prompting.

---

## Environment variables

**`backend/.env`**
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
OPENAI_API_KEY=""                 # <-- your OpenAI key (server-side only)
OPENAI_REALTIME_MODEL="gpt-realtime-translate"
```

**`frontend/.env`**
```
REACT_APP_BACKEND_URL=<public backend URL>   # http://localhost:8001 for local
```

> The account behind `OPENAI_API_KEY` must have credits and Tier 1+ access to `gpt-realtime-translate`.

---

## Run locally (macOS / Mac Studio)

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Frontend** (use yarn, not npm)
```bash
cd frontend
yarn install
yarn start
```

MongoDB is only scaffolding (not used for translation). Install if needed: `brew install mongodb-community && brew services start mongodb-community`.

---

## How to use

### Audio setup
1. Open **Audio Setup**, pick your **Input Device** (built-in mic, USB microphone, USB / USB-C audio interface, or a conference mixer via USB audio).
2. Press **TEST INPUT** and watch the level meter + peak indicator. TEST INPUT never sends audio to OpenAI and produces no feedback. Confirm signal before starting.
3. Use headphones to avoid echo.

### Event Profiles
Open **Event Profile** and fill Event Name, Organization, Speakers and custom vocabulary (Names, Acronyms, Technical, Biblical, Places) — **one item per line** — plus additional instructions. These are compiled into the session instructions and always included in exports.

### Translation Modes
Pick **General / Sermon / Academic / Business / Custom**. **Sermon** preserves biblical references, theology, names, repetitions and emphasis. **Custom** lets you write your own interpreter instructions.

### Start translating
Choose **FR → EN** or **EN → FR**, press **START**, speak. Source and Translation transcripts stream live; translated audio plays in real time. Use **MUTE INPUT**, **MUTE TRANSLATION**, **RESTART**, **STOP**. Toggle **Fullscreen** for large transcripts.

### English → French test
Set direction to **EN → FR**, speak English → French transcript + French audio.

### Transcripts & export
Nothing is stored by default. Enable **Save transcripts** to keep them after stopping. **Export TXT** or **Export PDF** on demand (includes event, date/time, languages, source + translation).

### Experimental: Tab / Screen audio (desktop)
In Audio Setup choose **Tab / Screen**, START, pick the tab and enable **Share tab audio** (e.g. a YouTube livestream) to translate it live. Support varies by browser/OS; microphone/USB input is unaffected if unavailable. No scraping/downloading — browser live capture only.

### Debug
Visit **`/debug`** for OpenAI/WebRTC/ICE state, audio device, events, reconnections, timestamps and latency. The key is never shown.

---

## Security
`OPENAI_API_KEY` is server-side only, never sent to the browser, never in frontend logs or network responses, never printed in backend logs. Browser uses only ephemeral (`ek_...`) session secrets. `.env` files are git-ignored.

## Known limitations
- `gpt-realtime-translate` supports 13 output languages and does not officially accept custom prompts/glossaries — Event Profile/Mode steering is best-effort with fallback.
- Latency is an **estimate** (source→translation event), labelled as such.
- Tab/screen audio is experimental and desktop-oriented.
