# Live audio acceptance test

Deployment is not an audio quality certification. Run these checks before a public event.

1. Use the same English teaching excerpt for each comparison. In Chrome on the Mac, select the video tab audio, not speaker-to-microphone capture. Choose French as translation target.
2. Create an event, enable listener captions, share its link (never the operator code) and listen on the Pixel with headphones.
3. Run 20–30 minutes. Note elapsed time, missing words, voice changes, playback interruptions and observed delay. Download a Debug snapshot during a problem and during a good interval. Its metrics describe OpenAI → Mac only, and transcript timing is not audio latency.
4. Add two or three listeners, then increase gradually. Record the number tested; the configured capacity is not a verified capacity claim.
5. Briefly disable the phone network, restore it, and verify reconnection. Check captions and audio resume without another event or PIN leak.
6. Test headphones, switching Wi-Fi/mobile data and screen locking separately. Background playback depends on the browser and OS; keep the page open if interrupted.
7. Stop the event and translation session. Confirm audio stops on all phones. Muting alone does not stop API usage.

Pass conditions: understandable continuous translation, no unexplained skipped passages, acceptable measured delay for the event, recovery from the tested interruptions, and no unauthorized operator access. Document actual results rather than checking these off automatically.

## Rotate the exposed operator code
Outside any live session, on the VPS in /opt/translatebox:

    python3 scripts/rotate-operator-code.py

This atomically replaces only OPERATOR_TOKEN, preserves the API key, and recreates the backend. Active sessions disconnect. Save the new printed code privately and sign in again. Do not share terminal output containing the new code. Existing saved events remain in the Docker volume.

## Not implemented by this update
Individual organizer accounts, billing/credit measurement, hard spending caps, and fixed-voice synthesis require separate backend work. The UI timer and mute buttons are not financial limits. No claim is made of completed multi-device or long-duration live tests.
