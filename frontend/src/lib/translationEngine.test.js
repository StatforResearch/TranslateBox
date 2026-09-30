import { test, expect, vi } from 'vitest';
import { TranslationEngine } from './translationEngine';

test('stopping during microphone permission releases the late stream', async () => {
  let resolve;
  const track = {stop: vi.fn()};
  const engine = new TranslationEngine({apiBase: '/api'});
  engine._capture = vi.fn(() => new Promise(r => {resolve = r;}));
  const pending = engine.start();
  await Promise.resolve();
  engine.stop();
  resolve({getTracks: () => [track]});
  await pending;
  expect(track.stop).toHaveBeenCalled();
  expect(engine.localStream).toBe(null);
  expect(engine.active).toBe(false);
});

test('stopping during token minting cannot create a peer connection', async () => {
  let resolve;
  const track = {stop: vi.fn()};
  const engine = new TranslationEngine({apiBase: '/api'});
  engine._capture = vi.fn().mockResolvedValue({getTracks: () => [track], getAudioTracks: () => [track]});
  engine._startMeter = vi.fn();
  engine._getEphemeral = vi.fn(() => new Promise(r => {resolve = r;}));
  global.RTCPeerConnection = vi.fn();
  const pending = engine.start();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  engine.stop(); resolve('ek_test');
  await pending;
  expect(RTCPeerConnection).not.toHaveBeenCalled();
  expect(track.stop).toHaveBeenCalled();
});

test('WebRTC diagnostics use interval deltas and stop polling on teardown', async () => {
  vi.useFakeTimers();
  try {
    const onMetrics = vi.fn();
    const engine = new TranslationEngine({handlers: {onMetrics}});
    const report = (received, lost, concealed, samples, delay, emitted) => new Map([
      ['audio', {id: 'audio', type: 'inbound-rtp', kind: 'audio', packetsReceived: received, packetsLost: lost, concealedSamples: concealed, totalSamplesReceived: samples, jitterBufferDelay: delay, jitterBufferEmittedCount: emitted, jitter: .012}],
      ['transport', {type: 'transport', selectedCandidatePairId: 'pair'}],
      ['pair', {currentRoundTripTime: .05}],
    ]);
    const pc = {getStats: vi.fn().mockResolvedValueOnce(report(100, 0, 0, 1000, 2, 100)).mockResolvedValueOnce(report(198, 2, 20, 2000, 5, 200)), close: vi.fn()};
    engine.active = true; engine.pc = pc; engine._startStats(pc);
    await vi.advanceTimersByTimeAsync(2000);
    expect(onMetrics.mock.lastCall[0].packetLossPct).toBeNull();
    await vi.advanceTimersByTimeAsync(2000);
    expect(onMetrics.mock.lastCall[0]).toEqual({packetLossPct: 2, concealedPct: 2, jitterMs: 12, jitterBufferMs: 30, rttMs: 50});
    engine.stop();
    await vi.advanceTimersByTimeAsync(6000);
    expect(pc.getStats).toHaveBeenCalledTimes(2);
  } finally { vi.useRealTimers(); }
});

test('late WebRTC stats cannot update a stopped session', async () => {
  vi.useFakeTimers();
  try {
    let resolve;
    const onMetrics = vi.fn();
    const engine = new TranslationEngine({handlers: {onMetrics}});
    const pc = {getStats: vi.fn(() => new Promise(r => {resolve = r;})), close: vi.fn()};
    engine.active = true; engine.pc = pc; engine._startStats(pc);
    await vi.advanceTimersByTimeAsync(2000);
    engine.stop(); onMetrics.mockClear(); resolve(new Map());
    await vi.advanceTimersByTimeAsync(6000);
    expect(onMetrics).not.toHaveBeenCalled();
    expect(pc.getStats).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});

test('legacy display selection never requests screen sharing', async () => {
  const stream = {getAudioTracks: () => [{}]};
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  const getDisplayMedia = vi.fn();
  const previous = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: {getUserMedia, getDisplayMedia}});
  try {
    const engine = new TranslationEngine({apiBase: '/api'});
    expect(await engine._capture('', 'display', true)).toBe(stream);
    expect(getDisplayMedia).not.toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({video: false}));
  } finally {
    if (previous) Object.defineProperty(navigator, 'mediaDevices', previous);
    else delete navigator.mediaDevices;
  }
});


test.each([true, false])('microphone mode reaches session configuration: ambient=%s', async (ambient) => {
  const engine = new TranslationEngine({apiBase: '/api'});
  engine.ambient = ambient;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: async () => ({value: 'ek_test'})}));
  try {
    await engine._getEphemeral();
    expect(JSON.parse(fetch.mock.calls[0][1].body).noise_reduction).toBe(ambient ? 'far_field' : 'near_field');
  } finally { vi.unstubAllGlobals(); }
});
