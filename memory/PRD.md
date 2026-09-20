# TranslateBox Live — PRD

## Original Problem Statement
Production-quality MVP: real-time French speech → English speech interpretation web app running in Chrome/Safari on Android tablets, iPads, Windows, macOS. Press START, speak French, hear English through headphones. Uses OpenAI Realtime Translation API (`gpt-realtime-translate`) over WebRTC. Secure backend mints short-lived session credentials; permanent key never exposed to the browser. Tablet-first professional AV console UI, light/dark, PWA, hidden /debug page. No auth/billing/DB/multi-language/multi-listener in v1.

## User Choices
- OpenAI key configured LATER by user (currently empty).
- Model: `gpt-realtime-translate`.
- Default theme: Dark. Style: professional AV broadcast.
- /debug: free access via URL.

## Architecture
- **Backend (FastAPI)**: `POST /api/realtime-session` reads `OPENAI_API_KEY` and calls `https://api.openai.com/v1/realtime/translations/client_secrets` to mint an ephemeral client secret (with `OpenAI-Safety-Identifier`). Returns only the ephemeral `value`. `GET /api/health` reports key/model status. Key never leaves the server.
- **Frontend (React)**: `translationEngine.js` runs the WebRTC flow — getUserMedia → RTCPeerConnection → add mic track → `oai-events` data channel → POST SDP offer to `https://api.openai.com/v1/realtime/translations/calls` with the ephemeral secret → set remote answer → remote audio track plays translated English. Data-channel events `session.input_transcript.delta` (French) and `session.output_transcript.delta` (English) feed the live panels. Auto-reconnect (up to 3 attempts) on connection drop; a fresh ephemeral secret is minted on each reconnect (handles token expiry).
- **State**: `TranslationContext` (session state, transcripts, logs, raw events, status, timer, devices). `ThemeContext` (dark default, persisted).
- **PWA**: `manifest.json` + `service-worker.js` (app-shell cache; never caches `/api` or OpenAI traffic).

## Model Limitation (important)
`gpt-realtime-translate` is translation-only and does **not** support custom instructions/prompt steering (no glossary, no voice/system-prompt). The requested "professional simultaneous interpreter" instruction cannot be sent to this model; interpreter behavior (translate, don't answer/summarize) is intrinsic to the model. Output language is set via `audio.output.language = "en"`; French input is auto-detected. Input transcription uses `gpt-realtime-whisper` to populate the French panel.

## Implemented (2026-06)
- Secure `/api/realtime-session` + `/api/health` (verified: 200 health, 503 with clear message when key missing).
- WebRTC translation engine with reconnection + full error mapping (mic denied, no input, session token, OpenAI connect, network).
- Tablet-first AV console: header, source/target, device selector, START/STOP/MUTE/RESET, 4 status dots, session timer, two live transcript panels, error banner.
- Light/dark theme (dark default), PWA install, generated app icon.
- `/debug` diagnostics: session state grid, WebRTC/session log stream, raw realtime event inspector.
- Testing: 11/11 scenarios pass (backend + frontend), no bugs.

## Backlog
- P0: End-to-end live verification once `OPENAI_API_KEY` is added (French→English audio + both transcripts).
- P1: Optional transcript export/save (privacy off by default), input/output level meters, latency readout in debug.
- P2: Sanitize upstream OpenAI error text for production; rate-limit session minting; additional language pairs.
