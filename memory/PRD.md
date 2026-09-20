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

## V1 (2026-06) — Multi-listener broadcast
- ONE OpenAI FR→EN session (operator) → ONE translated stream → MANY listeners via a backend WebSocket hub. Verified: 20/20 backend, single-session guarantee (`openai_sessions:1` with N listeners), fan-out, late-joiner cached init chunk, PIN(4401)/limit(4429, max 30)/unknown(4404) close codes, no `sk-` leak.
- Event creation (secure id, optional PIN hash, captions flag), QR + fullscreen, listener page `/e/:id` (LISTEN/play/pause/volume/status/auto-reconnect/optional captions), operator BroadcastPanel (CREATE/START/STOP EVENT, RESTART BROADCAST, listeners count), `/loadtest` + `/api/stats` (psutil), Docker (Dockerfile.backend + docker-compose.yml). All V0.5 preserved. Checkpoint: /app/.v05_backup.
- NOT measured here (need user's real run): CPU/RAM/bandwidth at 5/10/20/30 real listeners, 60-min stability. Tools provided. iOS Safari lacks MediaSource audio (fallback message shown).
- Live WebRTC session cannot fully establish: OpenAI `/v1/realtime/translations/calls` returns **429 insufficient_quota** — the account tied to `OPENAI_API_KEY` has no credits. The key IS valid (ephemeral secrets mint fine). Fix: add credits + ensure Tier 1+ access to `gpt-realtime-translate`. No code change required.

## V0.5 (2026-06) — Operator upgrade
- Directions FR→EN and EN→FR (segmented toggle; sets audio.output.language en/fr; source auto-detected).
- AUDIO SETUP: device selector, input status, live level meter + peak, TEST INPUT (meter only, no OpenAI, no feedback), experimental Tab/Screen capture (getDisplayMedia).
- Event Profile (name, org, speakers, vocab: names/acronyms/technical/biblical/places, additional) + Modes (General/Sermon/Academic/Business/Custom). Compiled into session instructions and sent to backend, which attaches them with graceful fallback (retry without) → `instructions_applied` flag. Included in exports.
- Operator dashboard: summary bar, 5 status dots (Audio Input/OpenAI/Translation/Output Audio/Network), START/STOP/MUTE INPUT/MUTE TRANSLATION/RESTART, translated-audio ON/MUTED.
- Live transcripts + FULLSCREEN; SessionInfo (duration, translated minutes, reconnect count, connection status, est. avg latency); estimated latency (source→translation event, labelled "Estimated").
- Reconnection (up to 5 attempts, RECONNECTING…/LIVE), device-disconnect notification.
- Privacy: SAVE TRANSCRIPTS default OFF (transcripts cleared on stop unless enabled). EXPORT TXT / PDF on demand.
- Expanded /debug (PC/ICE state, reconnects, latency, output audio, capture source); key never displayed.
- README.md added. Testing iteration_5: 12/12 backend, 100% frontend.

## V0.5 verification status
- LIVE END-TO-END CONFIRMED (2026-06, after credits funded): WebRTC session reaches `connected` in ~1.5-2.1s, `session.created` received, translated audio track received + playback started; EN and FR targets both connect; STOP→START works without reload; mute/latency/reconnect wired. Backend 22/22 pytest, security headers + no `sk-` leak + frontend info-disclosure fix all verified (iteration_8).
- Source is now a selectable combobox (Auto-detect default among 70+); Target selectable among the 13 output languages. Minimalist UI; advanced config (modes, event profile, save, export) in a Settings dialog.
- Remaining human step: on a real device, speak into the mic to confirm spoken transcript + heard audio (harness cannot produce speech, so transcripts are empty in automated tests only).
- Security confirmed: permanent key server-side only; browser uses only `ek_` ephemeral secrets.

## Backlog
- P0: End-to-end live verification once `OPENAI_API_KEY` is added (French→English audio + both transcripts).
- P1: Optional transcript export/save (privacy off by default), input/output level meters, latency readout in debug.
- P2: Sanitize upstream OpenAI error text for production; rate-limit session minting; additional language pairs.


## Code-quality cleanup (2026-06)
Applied code-review fixes without changing behavior:
- Security: replaced `document.write` (PDF export) with a Blob-URL + `print()` approach in SettingsDialog.jsx.
- Logging: added console logging to previously-empty catch blocks (broadcast.js, LoadTest.jsx, TranslationContext); cleanup catches documented with intent comments (translationEngine.js).
- React keys: Debug.jsx log/event lists now use stable `${ts}-${i}` keys.
- Refactor (behavior-preserving):
  - Backend `server.py`: `create_realtime_session` split into `_enforce_session_abuse_controls`/`_resolve_target_language`/`_build_session_config`/`_openai_headers`/`_mint_session`; `ws_broadcast` split into `_run_operator`/`_run_listener`/`_fanout_bytes`/`_fanout_text`.
  - Frontend: new `hooks/usePersistentState.js` (localStorage-backed prefs) and `hooks/useBroadcast.js` (event/broadcast state); `TranslationContext` slimmed and spreads `useBroadcast`; `Console.jsx` split into `components/console/AudioControlCard.jsx` + `TransportControls.jsx`.
- Deliberately NOT changed (with rationale): localStorage kept for preferences (no secrets stored → sessionStorage would only hurt UX); WebRTC/WebSocket init effect deps left eslint-disabled (adding deps risks reconnect loops); no further big-bang rewrites on the working realtime path.
- Verified: backend 31/31 pytest (incl. WS pin gating, listener limit, 4404, operator→listener fan-out); frontend regression iteration_11 = 100% (0 console errors, 0 React key warnings).
