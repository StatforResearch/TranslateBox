export { WS_BASE } from './api';

export class OperatorBroadcaster {
  constructor(wsUrl, { token, onCount = () => {}, onStatus = () => {} } = {}) {
    Object.assign(this, { wsUrl, token, onCount, onStatus, ws: null, recorder: null });
  }
  start(stream) {
    return new Promise((resolve, reject) => {
      if (!globalThis.MediaRecorder?.isTypeSupported('audio/webm;codecs=opus')) {
        reject(new Error('Broadcast requires a browser with WebM/Opus recording support (Chrome or Edge).'));
        return;
      }
      const ws = this.ws = new WebSocket(this.wsUrl);
      let ready = false;
      const fail = (message) => { clearTimeout(timer); this.stop(); reject(new Error(message)); };
      const timer = setTimeout(() => fail('Broadcast connection timed out'), 10000);
      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: this.token }));
      ws.onmessage = ({ data }) => {
        let message;
        try { message = JSON.parse(data); } catch { return; }
        if (message.type === 'ready' && !ready) {
          try {
            this.recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 48000 });
            this.recorder.ondataavailable = ({ data: chunk }) => {
              if (chunk.size && ws.readyState === 1) {
                if (ws.bufferedAmount > 1024 * 1024) { this.stop(); this.onStatus({live: false, error: 'Broadcast connection too slow'}); return; }
                ws.send(chunk);
              }
            };
            this.recorder.start(250);
            ready = true; clearTimeout(timer); resolve();
          } catch (error) { fail(error.message); }
        }
        if (message.type === 'listeners') this.onCount(message.count);
      };
      ws.onerror = () => fail('Broadcast connection failed');
      ws.onclose = ({ code }) => {
        clearTimeout(timer);
        this.stop();
        this.onStatus({ live: false });
        if (!ready) reject(new Error(`Broadcast rejected (${code})`));
      };
    });
  }
  sendCaption(text) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ type: 'caption', text: text.slice(-6000) }));
  }
  stop() {
    if (this.recorder?.state !== 'inactive') this.recorder?.stop();
    this.recorder = null;
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null; }
  }
}
