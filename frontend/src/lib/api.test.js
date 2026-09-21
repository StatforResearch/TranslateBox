import { test, expect, vi } from 'vitest';
import { API, WS_BASE, operatorFetch, setOperatorToken } from './api';

test('defaults to same-origin HTTP and WebSocket URLs', () => {
  expect(API).toBe('/api');
  expect(WS_BASE).toBe(window.location.origin.replace(/^http/, 'ws'));
});
test('operator credential is a request header, never a URL', async () => {
  global.fetch = vi.fn().mockResolvedValue({ok: true});
  setOperatorToken('operator-secret');
  await operatorFetch('/api/events', {method: 'POST', headers: {'Content-Type': 'application/json'}});
  expect(fetch).toHaveBeenCalledWith('/api/events', expect.objectContaining({headers: {Authorization: 'Bearer operator-secret', 'Content-Type': 'application/json'}}));
});
