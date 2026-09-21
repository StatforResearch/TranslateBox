import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Play, Pause, Volume2, Wifi, WifiOff, Headphones } from "lucide-react";
import { WS_BASE } from "../lib/broadcast";

import { API } from "../lib/api";
import { getTarget } from "../lib/languages";

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

  const wantedRef = useRef(false);
  const objectUrlRef = useRef(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  const release = useCallback(() => {
    clearTimeout(retryRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    sbRef.current = null;
    msRef.current = null;
    queueRef.current = [];
  }, []);

  const stop = useCallback(() => {
    wantedRef.current = false;
    release();
    setListening(false);
    setConn("idle");
  }, [release]);

  useEffect(() => {
    const controller = new AbortController();
    setInfo(null); setErr("");
    fetch(`${API}/events/${id}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Event not found.")))
      .then(d => { setInfo(d); setNeedPin(d.pin_protected); setLive(d.live); })
      .catch(e => { if (e.name !== "AbortError") setErr(e.message); });
    return () => { controller.abort(); wantedRef.current = false; release(); };
  }, [id, release]);

  const pump = useCallback(() => {
    const sb = sbRef.current;
    const audio = audioRef.current;
    if (!sb || sb.updating || !queueRef.current.length) return;
    try {
      if (sb.buffered.length && audio.currentTime - sb.buffered.start(0) > 30) {
        sb.remove(sb.buffered.start(0), audio.currentTime - 10);
        return;
      }
      sb.appendBuffer(queueRef.current[0]);
      queueRef.current.shift();
    } catch {
      setErr("Audio playback failed. Stop and rejoin the event.");
    }
  }, []);

  const connect = useCallback(function openStream() {
    release();
    if (!wantedRef.current) return;
    if (!globalThis.MediaSource?.isTypeSupported('audio/webm;codecs=opus')) {
      setErr("Your browser cannot play this broadcast. Use Chrome or Edge with WebM/Opus support.");
      wantedRef.current = false; setListening(false); return;
    }
    setConn("connecting");
    const ms = new MediaSource();
    msRef.current = ms;
    objectUrlRef.current = URL.createObjectURL(ms);
    audioRef.current.src = objectUrlRef.current;
    ms.addEventListener("sourceopen", () => {
      if (msRef.current !== ms) return;
      try {
        const sb = ms.addSourceBuffer('audio/webm;codecs=opus');
        sbRef.current = sb;
        sb.addEventListener("updateend", () => {
          if (sbRef.current !== sb) return;
          // Late listeners start near the live edge, not at the cached header timestamp.
          if (sb.buffered.length && audioRef.current) {
            const end = sb.buffered.end(sb.buffered.length - 1);
            if (end - audioRef.current.currentTime > 3) audioRef.current.currentTime = Math.max(0, end - 0.5);
            if (!pausedRef.current) audioRef.current.play().catch(() => {});
          }
          pump();
        });
        sb.addEventListener("error", () => { setErr("Audio interrupted. Reconnecting…"); wsRef.current?.close(); });
        pump();
      } catch { setErr("Unable to initialize audio playback."); stop(); }
    }, { once: true });

    const ws = new WebSocket(`${WS_BASE}/api/ws/${id}?role=listener`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    let wasLive = false;
    ws.onopen = () => { ws.send(JSON.stringify({type: "auth", pin: pin || null})); };
    ws.onmessage = ({data}) => {
      if (wsRef.current !== ws) return;
      if (typeof data === "string") {
        try {
          const m = JSON.parse(data);
          if (m.type === "status") {
            setConn("connected"); setLive(m.live);
            // A new recorder has a new WebM header; reconnect to a fresh MediaSource.
            if (wasLive && !m.live) { ws.close(); return; }
            wasLive = m.live;
          }
          if (m.type === "caption") setCaption(m.text || "");
        } catch {}
        return;
      }
      if (queueRef.current.length >= 120) { ws.close(); return; }
      queueRef.current.push(new Uint8Array(data));
      pump();
    };
    ws.onclose = ({code}) => {
      if (wsRef.current !== ws) return;
      release(); setConn("disconnected");
      const messages = {4401: "Incorrect PIN.", 4403: "This site is not allowed by the server.", 4429: "Event capacity or connection limit reached. Try again shortly.", 4404: "Event not found."};
      if (messages[code]) {
        setErr(messages[code]); if (code === 4401) setNeedPin(true);
        wantedRef.current = false; setListening(false); return;
      }
      if (wantedRef.current) retryRef.current = setTimeout(openStream, 1500);
    };
    ws.onerror = () => setConn("disconnected");
  }, [id, pin, pump, release, stop]);

  const listen = () => {
    setErr(""); setCaption(""); pausedRef.current = false; setPaused(false);
    wantedRef.current = true; setListening(true); connect();
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    if (pausedRef.current) a.pause();
    else a.play().catch(() => setErr("Press play again to enable audio."));
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
          <span className="text-4xl">{getTarget(info?.target || "en").flag}</span>
          <span className="text-lg font-semibold uppercase tracking-wider">
            {getTarget(info?.target || "en").native}
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
              <button aria-label={paused ? "Play audio" : "Pause audio"} data-testid="listener-playpause" onClick={togglePlay} className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                {!paused ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-white" />}
              </button>
              <Volume2 className="h-5 w-5 text-slate-400" />
              <input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume}
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
            {caption && (
              <div data-testid="listener-caption" className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4 text-left text-lg leading-relaxed text-slate-100 max-h-52 overflow-y-auto whitespace-pre-wrap">
                {caption}
              </div>
            )}
          </div>
        )}
        {err && <p className="mt-4 text-rose-400 text-sm font-mono" data-testid="listener-error">{err}</p>}
        <audio ref={audioRef} playsInline />
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
