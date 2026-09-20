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
- Secure `/api/realtime-session` + `/api/health` (verified against live OpenAI).
- **Multi-language support**: source auto-detected (70+ input languages, selector default "Auto-detect"); target selectable from the 13 supported output languages (en, es, fr, de, it, pt, ru, zh, ja, ko, hi, id, vi). Backend validates target (case-insensitive) and sets `audio.output.language`; input uses `gpt-realtime-whisper` + `noise_reduction: near_field`. Selected target is sent to the backend on START; transcript labels + badge update dynamically; selectors disabled while active.
- WebRTC translation engine with reconnection + full error mapping.
- Tablet-first AV console, light/dark (dark default), PWA, generated icon, `/debug` diagnostics.
- Testing: iteration_1 (11/11), iteration_2 (live session mint OK), iteration_3 (multi-language 8/8 backend + 100% frontend). All pass.

## Known external blocker
- Live WebRTC session cannot fully establish: OpenAI `/v1/realtime/translations/calls` returns **429 insufficient_quota** — the account tied to `OPENAI_API_KEY` has no credits. The key IS valid (ephemeral secrets mint fine). Fix: add credits + ensure Tier 1+ access to `gpt-realtime-translate`. No code change required.

## Model note
`gpt-realtime-translate` auto-detects the source language and does not support custom prompt/instruction steering. Output language is the only configurable translation parameter.

## Backlog
- P0: End-to-end live verification once `OPENAI_API_KEY` is added (French→English audio + both transcripts).
- P1: Optional transcript export/save (privacy off by default), input/output level meters, latency readout in debug.
- P2: Sanitize upstream OpenAI error text for production; rate-limit session minting; additional language pairs.
