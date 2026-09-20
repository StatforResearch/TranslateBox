// Operator-side broadcaster: captures the ONE translated audio stream and
// publishes it (Opus/WebM) to the backend hub over a single WebSocket.
// Listeners receive the fan-out from the backend — they never touch OpenAI.
export class OperatorBroadcaster {
  constructor(wsUrl, { onCount, onStatus } = {}) {
    this.wsUrl = wsUrl;
    this.onCount = onCount || (() => {});
    this.onStatus = onStatus || (() => {});
    this.ws = null;
    this.recorder = null;
  }

  start(stream) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.binaryType = "arraybuffer";
      this.ws.onopen = () => {
        try {
          const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "audio/webm";
          this.recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 48000 });
          this.recorder.ondataavailable = async (e) => {
            if (e.data && e.data.size > 0 && this.ws && this.ws.readyState === 1) {
              this.ws.send(await e.data.arrayBuffer());
            }
          };
          this.recorder.start(250); // 250ms chunks -> low latency
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      this.ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.type === "listeners") this.onCount(m.count);
          if (m.type === "status") this.onStatus(m);
        } catch {}
      };
      this.ws.onerror = () => reject(new Error("Broadcast WebSocket error"));
    });
  }

  sendCaption(text) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ type: "caption", text }));
    }
  }

  stop() {
    try { this.recorder && this.recorder.state !== "inactive" && this.recorder.stop(); } catch {}
    try { this.ws && this.ws.close(); } catch {}
    this.recorder = null;
    this.ws = null;
  }
}

export const WS_BASE = (process.env.REACT_APP_BACKEND_URL || "").replace(/^http/, "ws");
