export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
export const API = `${BACKEND_URL}/api`;
export const WS_BASE = (BACKEND_URL || window.location.origin).replace(/^http/, 'ws');
let operatorToken = '';
export function setOperatorToken(token) { operatorToken = token; }
export function operatorHeaders() { return { Authorization: `Bearer ${operatorToken}` }; }
export function operatorFetch(url, options = {}) {
  return fetch(url, { ...options, headers: { ...operatorHeaders(), ...options.headers } });
}
