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
