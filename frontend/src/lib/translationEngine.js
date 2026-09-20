const OUTPUT_LANGUAGE = "en";
const OPENAI_CALLS_URL = "https://api.openai.com/v1/realtime/translations/calls";
const MAX_RECONNECTS = 3;

// Handles browser-to-OpenAI real-time translation over WebRTC.
// The permanent API key stays on the server; this engine only ever sees the
// short-lived ephemeral client secret returned by /api/realtime-session.
export class TranslationEngine {
  constructor({ apiBase, handlers }) {
    this.apiBase = apiBase;
    this.h = handlers || {};
    this.pc = null;
    this.dc = null;
    this.localStream = null;
    this.audioEl = null;
    this.active = false;
    this.deviceId = null;
    this.reconnectAttempts = 0;
    this._reconnecting = false;
  }

  log(level, message, data) {
    this.h.onLog?.({ ts: new Date().toISOString(), level, message, data });
  }

  setStatus(patch) {
    this.h.onStatus?.(patch);
  }

  attachAudio(el) {
    this.audioEl = el;
  }

  async listDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput");
  }

  async _getEphemeral() {
    this.setStatus({ openai: "connecting" });
    this.log("info", "Requesting ephemeral session from backend");
    const res = await fetch(`${this.apiBase}/realtime-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_language: OUTPUT_LANGUAGE }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.json()).detail;
      } catch {
        detail = await res.text();
      }
      throw new Error(`SESSION_TOKEN:${res.status}:${detail}`);
    }
    const data = await res.json();
    const value = data.value || data.client_secret?.value;
    if (!value) throw new Error("SESSION_TOKEN:0:No ephemeral client secret returned by backend");
    this.log("info", "Received ephemeral client secret", { expires_at: data.expires_at });
    return value;
  }

  async start(deviceId) {
    if (this.active) return;
    this.active = true;
    this.deviceId = deviceId;
    this.reconnectAttempts = 0;
    try {
      await this._connect();
    } catch (err) {
      this.active = false;
      this._teardownPc();
      throw err;
    }
  }

  async _connect() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: this.deviceId ? { exact: this.deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (e) {
      this.setStatus({ mic: "denied" });
      throw new Error("MIC_PERMISSION:" + e.name + ":" + e.message);
    }

    if (!stream.getAudioTracks().length) {
      this.setStatus({ mic: "denied" });
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("NO_AUDIO_INPUT::No audio track available from the selected device");
    }
    this.localStream = stream;
    this.setStatus({ mic: "active" });
    this.log("info", "Microphone stream acquired", { deviceId: this.deviceId });

    const ephemeral = await this._getEphemeral();

    const pc = new RTCPeerConnection();
    this.pc = pc;

    pc.oniceconnectionstatechange = () => {
      this.log("debug", "ICE connection state: " + pc.iceConnectionState);
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      this.log("info", "PeerConnection state: " + st);
      if (st === "connected") {
        this.setStatus({ network: "optimal", openai: "connected" });
        this.reconnectAttempts = 0;
      } else if (st === "disconnected" || st === "failed") {
        this.setStatus({ network: "degraded" });
        this._handleDrop();
      }
    };

    pc.ontrack = (ev) => {
      this.log("info", "Remote translated audio track received");
      if (this.audioEl) this.audioEl.srcObject = ev.streams[0];
    };

    pc.addTrack(stream.getAudioTracks()[0], stream);

    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onopen = () => this.log("info", "Realtime data channel open");
    dc.onclose = () => this.log("info", "Realtime data channel closed");
    dc.onmessage = (e) => this._onEvent(e.data);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.log("debug", "SDP offer created, posting to OpenAI");

    const sdpRes = await fetch(OPENAI_CALLS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${ephemeral}`, "Content-Type": "application/sdp" },
      body: offer.sdp,
    });
    if (!sdpRes.ok) {
      const t = await sdpRes.text();
      this.setStatus({ openai: "error" });
      throw new Error(`OPENAI_CONNECT:${sdpRes.status}:${t}`);
    }
    const answer = await sdpRes.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
    this.log("info", "SDP answer applied — establishing stream");
    this.setStatus({ openai: "connected" });
  }

  _onEvent(raw) {
    let ev;
    try {
      ev = JSON.parse(raw);
    } catch {
      return;
    }
    this.h.onRawEvent?.(ev);
    switch (ev.type) {
      case "session.created":
      case "session.updated":
        this.setStatus({ openai: "connected" });
        this.log("info", "Realtime session " + ev.type.split(".")[1]);
        break;
      case "session.input_transcript.delta":
        this.setStatus({ translation: "interpreting" });
        this.h.onTranscript?.({ side: "source", delta: ev.delta });
        break;
      case "session.input_transcript.completed":
        this.h.onTranscript?.({ side: "source", segmentBreak: true });
        break;
      case "session.output_transcript.delta":
        this.setStatus({ translation: "interpreting" });
        this.h.onTranscript?.({ side: "target", delta: ev.delta });
        break;
      case "session.output_transcript.completed":
        this.h.onTranscript?.({ side: "target", segmentBreak: true });
        break;
      case "error":
        this.log("error", "Realtime API error", ev.error || ev);
        this.h.onError?.(ev.error?.message || "Realtime API error");
        break;
      default:
        this.log("debug", "Event: " + ev.type);
    }
  }

  async _handleDrop() {
    if (!this.active || this._reconnecting) return;
    if (this.reconnectAttempts >= MAX_RECONNECTS) {
      this.setStatus({ openai: "error", network: "offline" });
      this.h.onError?.("Connection lost. Automatic reconnection attempts exhausted. Press STOP then START to retry.");
      return;
    }
    this._reconnecting = true;
    this.reconnectAttempts += 1;
    const n = this.reconnectAttempts;
    this.log("warn", `Connection dropped — reconnect attempt ${n}/${MAX_RECONNECTS}`);
    this.h.onError?.(`Connection interrupted — reconnecting (${n}/${MAX_RECONNECTS})…`);
    this._teardownPc();
    await new Promise((r) => setTimeout(r, 1200 * n));
    if (!this.active) {
      this._reconnecting = false;
      return;
    }
    try {
      await this._connect();
      this.h.onError?.(null);
      this.log("info", "Reconnection successful");
    } catch (e) {
      this.log("error", "Reconnect failed: " + e.message);
      this._reconnecting = false;
      this._handleDrop();
      return;
    }
    this._reconnecting = false;
  }

  _teardownPc() {
    if (this.dc) {
      try {
        this.dc.close();
      } catch {}
      this.dc = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
  }

  setMuted(muted) {
    if (this.audioEl) this.audioEl.muted = muted;
  }

  stop() {
    this.active = false;
    this._reconnecting = false;
    this._teardownPc();
    if (this.audioEl) this.audioEl.srcObject = null;
    this.setStatus({
      mic: "idle",
      openai: "standby",
      translation: "standby",
      network: navigator.onLine ? "optimal" : "offline",
    });
    this.log("info", "Session stopped cleanly");
  }
}
