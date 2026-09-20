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
    this.ambient = false;
    this._preferredSink = null;
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
      el.playsInline = true;
      el.volume = 1;
      el.onplaying = () => {
        this.setStatus({ outputAudio: el.muted ? "muted" : "active" });
        this.log("info", "Translated audio playback started");
      };
      this._applySink();
    }
  }

  outputSupported() {
    return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
  }

  async listOutputDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audiooutput");
  }

  async _applySink() {
    if (this.audioEl && this._preferredSink && this.outputSupported()) {
      try {
        await this.audioEl.setSinkId(this._preferredSink);
      } catch (e) {
        this.log("warn", "Could not route audio to selected output: " + e.message);
      }
    }
  }

  async setOutputDevice(deviceId) {
    this._preferredSink = deviceId || null;
    await this._applySink();
    this.log("info", "Output device set", { deviceId });
  }

  async listDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput");
  }

  // ---- audio capture ----
  async _capture(deviceId, source, ambient) {
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
      // Ambient/TV mode disables the browser's echo/noise/gain processing so
      // audio coming from a TV or PA system is not gated as "background noise".
      const proc = ambient
        ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          ...proc,
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
      } catch { /* already disconnected */ }
      this._meterSrc = null;
    }
    this._analyser = null;
    this.h.onLevel?.({ level: 0, peak: 0 });
  }

  async testInput(deviceId, source = "mic", ambient = false) {
    await this.stopTest();
    const stream = await this._capture(deviceId, source, ambient);
    this._testStream = stream;
    this.setStatus({ mic: "active" });
    this.log("info", "TEST INPUT started (metering only, not sent to OpenAI)", { deviceId, source, ambient });
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

  async start({ deviceId, source = "mic", targetLanguage = "en", instructions = "", ambient = false } = {}) {
    if (this.active) return;
    this.active = true;
    this.deviceId = deviceId;
    this.captureSource = source;
    this.ambient = ambient;
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
    const stream = await this._capture(this.deviceId, this.captureSource, this.ambient);
    this.localStream = stream;
    this.setStatus({ mic: "active" });
    this.log("info", "Input stream acquired", { deviceId: this.deviceId, source: this.captureSource, ambient: this.ambient });
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
      } else if (st === "failed") {
        this.setStatus({ network: "degraded" });
        this._handleDrop();
      } else if (st === "disconnected") {
        // Transient blips shouldn't tear down the stream (which cuts audio).
        // Only reconnect if it hasn't recovered after a short grace period.
        this.setStatus({ network: "degraded" });
        setTimeout(() => {
          if (this.active && this.pc && (this.pc.connectionState === "disconnected" || this.pc.connectionState === "failed")) {
            this._handleDrop();
          }
        }, 4000);
      }
    };

    pc.ontrack = (ev) => {
      this.log("info", "Remote translated audio track received");
      if (this.audioEl) {
        this.audioEl.srcObject = ev.streams[0];
        this._applySink();
      }
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
      // Do NOT surface the raw upstream body to the UI (info disclosure). Log
      // full details to the console for debugging; propagate only the status.
      console.error("[OpenAI /calls] error", sdpRes.status, t);
      this.log("error", "OpenAI /calls error " + sdpRes.status, { status: sdpRes.status });
      this.setStatus({ openai: "error" });
      throw new Error(`OPENAI_CONNECT:${sdpRes.status}:`);
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
      } catch { /* already closed */ }
      this.dc = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch { /* already closed */ }
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
