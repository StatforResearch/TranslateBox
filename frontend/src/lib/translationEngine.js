const OPENAI_CALLS_URL = "https://api.openai.com/v1/realtime/translations/calls";
const MAX_RECONNECTS = 5;

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
    this.captureSource = "mic";
    this.targetLanguage = "en";
    this.instructions = "";
    this.reconnectAttempts = 0;
    this._reconnecting = false;
    // metering
    this._audioCtx = null;
    this._analyser = null;
    this._meterSrc = null;
    this._meterRAF = null;
    this._testStream = null;
    // latency
    this._segStart = 0;
    this._segActive = false;
    this._segMeasured = false;
    this._latencies = [];
  }

  log(level, message, data) {
    this.h.onLog?.({ ts: new Date().toISOString(), level, message, data });
  }

  setStatus(patch) {
    this.h.onStatus?.(patch);
  }

  attachAudio(el) {
    this.audioEl = el;
    if (el) {
      el.onplaying = () => {
        this.setStatus({ outputAudio: el.muted ? "muted" : "active" });
        this.log("info", "Translated audio playback started");
      };
    }
  }

  async listDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput");
  }

  // ---- audio capture ----
  async _capture(deviceId, source) {
    if (source === "display") {
      let stream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch (e) {
        throw new Error("MIC_PERMISSION:" + e.name + ":" + e.message);
      }
      if (!stream.getAudioTracks().length) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error('NO_AUDIO_INPUT::No tab/screen audio was shared. Re-share and enable "Share tab audio".');
      }
      // We only need audio; stop the video track to save resources.
      stream.getVideoTracks().forEach((t) => t.stop());
      return stream;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
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
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("NO_AUDIO_INPUT::No audio track from the selected device.");
    }
    return stream;
  }

  // ---- input level meter (no output routing => no feedback) ----
  _startMeter(stream) {
    try {
      this._audioCtx = this._audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (this._audioCtx.state === "suspended") this._audioCtx.resume().catch(() => {});
      const src = this._audioCtx.createMediaStreamSource(stream);
      const analyser = this._audioCtx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      this._meterSrc = src;
      this._analyser = analyser;
      const data = new Uint8Array(analyser.fftSize);
      let peak = 0;
      const loop = () => {
        if (!this._analyser) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        let p = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
          if (Math.abs(v) > p) p = Math.abs(v);
        }
        const rms = Math.sqrt(sum / data.length);
        peak = Math.max(peak * 0.92, p);
        this.h.onLevel?.({ level: Math.min(1, rms * 2.6), peak: Math.min(1, peak) });
        this._meterRAF = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      this.log("warn", "Level meter unavailable: " + e.message);
    }
  }

  _stopMeter() {
    if (this._meterRAF) cancelAnimationFrame(this._meterRAF);
    this._meterRAF = null;
    if (this._meterSrc) {
      try {
        this._meterSrc.disconnect();
      } catch {}
      this._meterSrc = null;
    }
    this._analyser = null;
    this.h.onLevel?.({ level: 0, peak: 0 });
  }

  async testInput(deviceId, source = "mic") {
    await this.stopTest();
    const stream = await this._capture(deviceId, source);
    this._testStream = stream;
    this.setStatus({ mic: "active" });
    this.log("info", "TEST INPUT started (metering only, not sent to OpenAI)", { deviceId, source });
    this._startMeter(stream);
  }

  async stopTest() {
    this._stopMeter();
    if (this._testStream) {
      this._testStream.getTracks().forEach((t) => t.stop());
      this._testStream = null;
      this.setStatus({ mic: "idle" });
      this.log("info", "TEST INPUT stopped");
    }
  }

  // ---- session ----
  async _getEphemeral() {
    this.setStatus({ openai: "connecting" });
    this.log("info", "Requesting ephemeral session from backend");
    const res = await fetch(`${this.apiBase}/realtime-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_language: this.targetLanguage, instructions: this.instructions }),
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
    this.log("info", "Received ephemeral client secret", {
      expires_at: data.expires_at,
      instructions_applied: data.instructions_applied,
    });
    this.h.onMetrics?.({ instructionsApplied: !!data.instructions_applied });
    return value;
  }

  async start({ deviceId, source = "mic", targetLanguage = "en", instructions = "" } = {}) {
    if (this.active) return;
    this.active = true;
    this.deviceId = deviceId;
    this.captureSource = source;
    this.targetLanguage = targetLanguage;
    this.instructions = instructions;
    this.reconnectAttempts = 0;
    this._latencies = [];
    try {
      await this._connect();
    } catch (err) {
      this.active = false;
      this._teardown();
      throw err;
    }
  }

  async _connect() {
    await this.stopTest();
    const stream = await this._capture(this.deviceId, this.captureSource);
    this.localStream = stream;
    this.setStatus({ mic: "active" });
    this.log("info", "Input stream acquired", { deviceId: this.deviceId, source: this.captureSource });
    this._startMeter(stream);

    const ephemeral = await this._getEphemeral();

    const pc = new RTCPeerConnection();
    this.pc = pc;

    pc.oniceconnectionstatechange = () => {
      this.log("debug", "ICE connection state: " + pc.iceConnectionState);
      this.h.onMetrics?.({ iceState: pc.iceConnectionState });
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      this.log("info", "PeerConnection state: " + st);
      this.h.onMetrics?.({ pcState: st });
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
      this.setStatus({ outputAudio: this.audioEl && this.audioEl.muted ? "muted" : "active" });
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

  _resetSegment() {
    this._segActive = false;
    this._segMeasured = false;
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
        if (!this._segActive) {
          this._segStart = performance.now();
          this._segActive = true;
          this._segMeasured = false;
        }
        this.setStatus({ translation: "interpreting" });
        this.h.onTranscript?.({ side: "source", delta: ev.delta });
        break;
      case "session.input_transcript.completed":
        this.h.onTranscript?.({ side: "source", segmentBreak: true });
        break;
      case "session.output_transcript.delta":
        if (this._segActive && !this._segMeasured) {
          const lat = performance.now() - this._segStart;
          this._segMeasured = true;
          this._latencies.push(lat);
          if (this._latencies.length > 50) this._latencies.shift();
          const avg = this._latencies.reduce((a, b) => a + b, 0) / this._latencies.length;
          this.h.onMetrics?.({ latencyMs: Math.round(lat), avgLatencyMs: Math.round(avg) });
        }
        this.setStatus({ translation: "interpreting" });
        this.h.onTranscript?.({ side: "target", delta: ev.delta });
        break;
      case "session.output_transcript.completed":
        this.h.onTranscript?.({ side: "target", segmentBreak: true });
        this._resetSegment();
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
      this.h.onError?.("Connection lost. Automatic reconnection attempts exhausted. Press RESTART to retry.");
      return;
    }
    this._reconnecting = true;
    this.reconnectAttempts += 1;
    const n = this.reconnectAttempts;
    this.setStatus({ openai: "connecting", reconnectCount: n });
    this.h.onMetrics?.({ reconnectCount: n });
    this.log("warn", `Connection dropped — reconnect attempt ${n}/${MAX_RECONNECTS}`);
    this.h.onError?.(`RECONNECTING… (${n}/${MAX_RECONNECTS})`);
    this._teardownPc();
    await new Promise((r) => setTimeout(r, Math.min(1200 * n, 5000)));
    if (!this.active) {
      this._reconnecting = false;
      return;
    }
    try {
      await this._connect();
      this.h.onError?.(null);
      this.log("info", "Reconnection successful — LIVE");
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

  _teardown() {
    this._stopMeter();
    this._teardownPc();
  }

  setTranslationMuted(muted) {
    if (this.audioEl) {
      this.audioEl.muted = muted;
      this.setStatus({ outputAudio: muted ? "muted" : this.pc ? "active" : "idle" });
    }
  }

  setInputMuted(muted) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    }
    this.setStatus({ mic: muted ? "muted" : this.active ? "active" : "idle" });
  }

  stop() {
    this.active = false;
    this._reconnecting = false;
    this._resetSegment();
    this._teardown();
    if (this.audioEl) this.audioEl.srcObject = null;
    this.setStatus({
      mic: "idle",
      openai: "standby",
      translation: "standby",
      outputAudio: "idle",
      network: navigator.onLine ? "optimal" : "offline",
    });
    this.log("info", "Session stopped cleanly");
  }
}
