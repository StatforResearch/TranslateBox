import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Play, Pause, Volume2, Wifi, WifiOff, Headphones } from "lucide-react";
import { WS_BASE } from "../lib/broadcast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Listener() {
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [pin, setPin] = useState("");
  const [needPin, setNeedPin] = useState(false);
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState(false);
  const [conn, setConn] = useState("idle");
  const [caption, setCaption] = useState("");
  const [volume, setVolume] = useState(1);

  const audioRef = useRef(null);
  const wsRef = useRef(null);
  const msRef = useRef(null);
  const sbRef = useRef(null);
  const queueRef = useRef([]);
  const retryRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/events/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => { setInfo(d); setNeedPin(d.pin_protected); setLive(d.live); })
      .catch(() => setErr("Event not found."));
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pump = useCallback(() => {
    const sb = sbRef.current;
    if (!sb || sb.updating || !queueRef.current.length) return;
    try { sb.appendBuffer(queueRef.current.shift()); } catch {}
  }, []);

  const connect = useCallback(() => {
    setConn("connecting");
    const ms = new MediaSource();
    msRef.current = ms;
    audioRef.current.src = URL.createObjectURL(ms);
    audioRef.current.volume = volume;
    ms.addEventListener("sourceopen", () => {
      try {
        const sb = ms.addSourceBuffer('audio/webm;codecs=opus');
        sbRef.current = sb;
        sb.addEventListener("updateend", pump);
      } catch (e) { setErr("Your browser can't play this stream (try Chrome / Android)."); }
    });

    const url = `${WS_BASE}/api/ws/${id}?role=listener${pin ? `&pin=${encodeURIComponent(pin)}` : ""}`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    ws.onopen = () => { setConn("connected"); };
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        try {
          const m = JSON.parse(ev.data);
          if (m.type === "status") setLive(m.live);
          if (m.type === "caption") setCaption(m.text || "");
        } catch {}
        return;
      }
      queueRef.current.push(new Uint8Array(ev.data));
      pump();
      audioRef.current && audioRef.current.paused && audioRef.current.play().catch(() => {});
    };
    ws.onclose = (e) => {
      setConn("disconnected");
      if (e.code === 4401) { setErr("Incorrect PIN."); setNeedPin(true); setListening(false); return; }
      if (e.code === 4429) { setErr("This event is full (30 listeners max)."); setListening(false); return; }
      if (e.code === 4404) { setErr("Event not found."); setListening(false); return; }
      if (listening) retryRef.current = setTimeout(connect, 1500); // auto-recover
    };
    ws.onerror = () => setConn("disconnected");
  }, [id, pin, volume, pump, listening]);

  const listen = () => {
    setErr("");
    setListening(true);
    connect();
  };

  const stop = () => {
    setListening(false);
    clearTimeout(retryRef.current);
    try { wsRef.current && wsRef.current.close(); } catch {}
    try { audioRef.current && audioRef.current.pause(); } catch {}
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  if (err && !info) {
    return <Shell><p className="text-rose-400 font-mono">{err}</p></Shell>;
  }

  return (
    <Shell>
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-mono uppercase tracking-[0.35em] text-emerald-400 mb-6">TranslateBox</p>
        <h1 className="text-2xl font-extrabold text-slate-50">{info?.name || "Live Interpretation"}</h1>
        {info?.organization && <p className="text-slate-400 mt-1">{info.organization}</p>}

        <div className="mt-8 mb-6 flex items-center justify-center gap-2 text-slate-300">
          <span className="text-4xl">🇬🇧</span>
          <span className="text-lg font-semibold uppercase tracking-wider">
            {info?.target === "fr" ? "Français" : "English"}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6" data-testid="listener-status">
          <span className={`h-2.5 w-2.5 rounded-full ${live ? "bg-emerald-400 shadow-[0_0_10px_2px_rgba(16,185,129,0.6)] animate-pulse" : "bg-slate-600"}`} />
          <span className="text-xs font-mono uppercase tracking-widest text-slate-400">{live ? "Live" : "Waiting for speaker…"}</span>
        </div>

        {needPin && !listening && (
          <input data-testid="listener-pin-input" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter event PIN"
            className="w-full h-12 mb-4 rounded-xl bg-white/5 border border-white/10 px-4 text-center text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        )}

        {!listening ? (
          <button data-testid="listener-listen-button" onClick={listen}
            className="w-full h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-bold shadow-[0_0_30px_rgba(16,185,129,0.35)] active:scale-[0.98] transition flex items-center justify-center gap-3">
            <Headphones className="h-6 w-6" /> LISTEN
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button data-testid="listener-playpause" onClick={togglePlay} className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                {audioRef.current && !audioRef.current.paused ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-white" />}
              </button>
              <Volume2 className="h-5 w-5 text-slate-400" />
              <input type="range" min="0" max="1" step="0.05" value={volume}
                onChange={(e) => { setVolume(+e.target.value); if (audioRef.current) audioRef.current.volume = +e.target.value; }}
                className="flex-1 accent-emerald-500" data-testid="listener-volume" />
              <button data-testid="listener-stop" onClick={stop} className="px-3 h-10 rounded-lg border border-white/15 text-slate-300 text-sm">Stop</button>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-500" data-testid="listener-conn">
              {conn === "connected" ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-amber-400" />}
              {conn}
            </div>
            {!live && conn === "connected" && (
              <p className="text-amber-400 text-sm font-mono">Translation temporarily unavailable — resuming automatically…</p>
            )}
            {info?.captions && caption && (
              <div data-testid="listener-caption" className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4 text-left text-lg leading-relaxed text-slate-100 max-h-52 overflow-y-auto whitespace-pre-wrap">
                {caption}
              </div>
            )}
          </div>
        )}
        {err && <p className="mt-4 text-rose-400 text-sm font-mono" data-testid="listener-error">{err}</p>}
        <audio ref={audioRef} autoPlay playsInline />
        <p className="mt-10 text-[11px] text-slate-600 font-mono">No account needed · audio is not recorded</p>
      </div>
    </Shell>
  );
}

const Shell = ({ children }) => (
  <div className="min-h-screen bg-[#0A0D14] text-slate-100 font-sans flex items-center justify-center p-6"
    style={{ backgroundImage: "radial-gradient(1000px 500px at 50% -10%, rgba(16,185,129,0.10), transparent 60%)" }}>
    {children}
  </div>
);
