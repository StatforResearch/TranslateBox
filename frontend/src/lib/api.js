export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
export const API = `${BACKEND_URL}/api`;
export const WS_BASE = (BACKEND_URL || window.location.origin).replace(/^http/, 'ws');
let operatorToken = '';
export function setOperatorToken(token) { operatorToken = token; }
export function operatorHeaders() { return { Authorization: `Bearer ${operatorToken}` }; }
export function operatorFetch(url, options = {}) {
  return fetch(url, { ...options, headers: { ...operatorHeaders(), ...options.headers } });
}

export async function responseError(response, fallback) {
  try {
    const body = await response.json();
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail)) return 'Check the field lengths and selected language, then try again.';
  } catch { /* Non-JSON proxy error */ }
  return fallback;
}
