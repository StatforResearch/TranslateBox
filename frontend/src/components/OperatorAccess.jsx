import React, { useState } from 'react';
import { API, setOperatorToken } from '../lib/api';

export default function OperatorAccess({ children }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/operator`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(response.status === 401 ? 'Invalid operator access code.' : 'Operator access unavailable. Check server configuration or try again shortly.');
      setOperatorToken(token); setToken(''); setReady(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  if (ready) return children;
  return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
    <form onSubmit={login} className="w-full max-w-sm space-y-5">
      <h1 className="text-3xl font-bold">TranslateBox Live</h1>
      <p className="text-slate-300">Enter your operator access code to start translating. Listeners can join with their event link.</p>
      <label className="block" htmlFor="operator-token">Operator access code</label>
      <input id="operator-token" type="password" autoComplete="current-password" required value={token} onChange={e => setToken(e.target.value)} className="w-full rounded-lg bg-slate-800 p-3" />
      <button disabled={busy} className="w-full rounded-lg bg-emerald-600 p-3 font-bold disabled:opacity-50">{busy ? 'Connecting…' : 'Open console'}</button>
      {error && <p role="alert" className="text-rose-300">{error}</p>}
    </form>
  </main>;
}
