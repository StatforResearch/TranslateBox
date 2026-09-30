import React from 'react';
import { test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { HeadphoneTest } from './HeadphoneTest';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
test('headphone test plays locally and releases its audio context', async () => {
  const tone = {frequency: {}, connect: vi.fn(), start: vi.fn(), stop: vi.fn()};
  const close = vi.fn().mockResolvedValue();
  vi.stubGlobal('AudioContext', class {
    currentTime = 0; destination = {}; close = close;
    resume = vi.fn().mockResolvedValue();
    createOscillator = () => tone;
    createGain = () => ({gain: {setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn()}, connect: vi.fn()});
  });
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<HeadphoneTest />);
  await act(async () => fireEvent.click(screen.getByText('Test my headphones')));
  expect(tone.start).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
  act(() => tone.onended());
  expect(close).toHaveBeenCalledOnce();
  expect(screen.getByRole('status').textContent).toContain('Did you hear');
});
