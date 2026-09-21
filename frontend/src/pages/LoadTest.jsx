import React, { useEffect, useRef, useState } from "react";
import { WS_BASE } from "../lib/broadcast";

import { API, operatorFetch } from "../lib/api";

export default function LoadTest() {
  const [eventId, setEventId] = useState("");
  const [target, setTarget] = useState(5);
  const [connected, setConnected] = useState(0);
  const [errors, setErrors] = useState(0);
  const [reconnects, setReconnects] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [stats, setStats] = useState(null);
  const socks = useRef([]);

  useEffect(() => {
    const t = setInterval(() => {
      operatorFetch(`${API}/stats`).then((r) => r.json()).then(setStats).catch((err) => console.debug("[loadtest] stats poll failed", err));
    }, 2000);
    return () => { clearInterval(t); stopAll(); };
    // eslint-disable-next-line
  }, []);

  const addOne = () => {
    const ws = new WebSocket(`${WS_BASE}/api/ws/${eventId}?role=listener`);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => { ws.send(JSON.stringify({type: "auth"})); setConnected((c) => c + 1); };
    ws.onmessage = (e) => { if (typeof e.data !== "string") setBytes((b) => b + e.data.byteLength); };
    ws.onerror = () => setErrors((x) => x + 1);
    ws.onclose = () => {
      setConnected((c) => Math.max(0, c - 1));
      if (socks.current.includes(ws)) { setReconnects((r) => r + 1); }
    };
    socks.current.push(ws);
  };

  const run = () => { for (let i = 0; i < target; i++) setTimeout(addOne, i * 60); };
  const stopAll = () => { socks.current.forEach((w) => { try { w.close(); } catch (err) { console.debug("[loadtest] socket close cleanup", err); } }); socks.current = []; setConnected(0); };

  const Stat = ({ label, value }) => (
    <div className="rounded-lg bg-[#121824] border border-white/10 px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">{label}</p>
      <p className="text-lg font-mono font-bold text-emerald-400">{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 font-mono p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-wider">Load Test</h1>
        <p className="text-sm text-slate-400">Open N simulated listeners against a live event and watch server stats. Create + START an event on the operator console first, then paste its ID.</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500">Event ID</label>
            <input data-testid="loadtest-event-id" value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="ABC123" className="block mt-1 h-11 w-48 rounded-lg bg-[#121824] border border-white/10 px-3" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500">Listeners</label>
            <select data-testid="loadtest-count" value={target} onChange={(e) => setTarget(+e.target.value)} className="block mt-1 h-11 w-28 rounded-lg bg-[#121824] border border-white/10 px-3">
              {[1, 5, 10, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button data-testid="loadtest-run" onClick={run} disabled={!eventId} className="h-11 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold disabled:opacity-50">CONNECT</button>
          <button data-testid="loadtest-stop" onClick={stopAll} className="h-11 px-5 rounded-lg border border-white/15">DISCONNECT ALL</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Connected (client)" value={connected} />
          <Stat label="Reconnects" value={reconnects} />
          <Stat label="Errors" value={errors} />
          <Stat label="Audio recv (KB)" value={Math.round(bytes / 1024)} />
        </div>

        <h2 className="text-sm uppercase tracking-widest text-slate-400 pt-2">Server stats (/api/stats)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="CPU %" value={stats?.cpu_percent ?? "—"} />
          <Stat label="RAM %" value={stats?.ram_percent ?? "—"} />
          <Stat label="OpenAI sessions" value={stats?.openai_sessions ?? "—"} />
          <Stat label="Total listeners" value={stats?.total_listeners ?? "—"} />
        </div>
        {stats && <p className="text-xs text-slate-500" data-testid="loadtest-sessions-note">Single-session guarantee: openai_sessions should be 1 while broadcasting regardless of listener count.</p>}
      </div>
    </div>
  );
}
