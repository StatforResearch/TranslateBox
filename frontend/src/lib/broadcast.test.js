import { beforeEach, test, expect, vi } from 'vitest';
import { OperatorBroadcaster } from './broadcast';
let socket;
beforeEach(() => {
  global.WebSocket = class {
    constructor() { socket = this; this.readyState = 1; this.bufferedAmount = 0; }
    send = vi.fn(); close = vi.fn();
  };
  global.MediaRecorder = class {
    static isTypeSupported() { return true; }
    constructor() { this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    stop = vi.fn();
  };
});
test('waits for authenticated server ready before recording', async () => {
  const broadcaster = new OperatorBroadcaster('ws://localhost/api/ws/event', {token: 'secret'});
  const pending = broadcaster.start({});
  socket.onopen();
  expect(JSON.parse(socket.send.mock.calls[0][0]).token).toBe('secret');
  expect(broadcaster.recorder).toBe(null);
  socket.onmessage({data: JSON.stringify({type: 'ready'})});
  await pending;
  expect(broadcaster.recorder.state).toBe('recording');
  broadcaster.stop();
  expect(socket.close).toHaveBeenCalled();
});
test('server rejection does not leave start pending', async () => {
  const broadcaster = new OperatorBroadcaster('ws://localhost/api/ws/event');
  const pending = broadcaster.start({});
  socket.onclose({code: 4401});
  await expect(pending).rejects.toThrow('4401');
  expect(broadcaster.ws).toBe(null);
});
