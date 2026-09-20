import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { TranslationEngine } from "../lib/translationEngine";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Ctx = createContext(null);
export const useTranslationSession = () => useContext(Ctx);

const INITIAL_STATUS = { mic: "idle", openai: "standby", translation: "standby", network: "optimal" };

function mapError(err) {
  const msg = err?.message || String(err);
  const [code, , ...rest] = msg.split(":");
  const detail = rest.join(":");
  switch (code) {
    case "MIC_PERMISSION":
      return "Microphone access was denied. Please allow microphone permission in your browser and try again.";
    case "NO_AUDIO_INPUT":
      return "No audio input detected on the selected device. Check your microphone or USB audio interface.";
    case "SESSION_TOKEN":
      return `Could not start a translation session. ${detail || "The OpenAI API key may be missing on the server."}`;
    case "OPENAI_CONNECT":
      return `Failed to connect to OpenAI Realtime (${msg.split(":")[1]}). ${detail?.slice(0, 200) || ""}`;
    default:
      return msg;
  }
}

export function TranslationProvider({ children }) {
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [logs, setLogs] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("en");

  const engineRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  if (!engineRef.current) {
    engineRef.current = new TranslationEngine({
      apiBase: API,
      handlers: {
        onStatus: (patch) => setStatus((s) => ({ ...s, ...patch })),
        onTranscript: ({ side, delta, segmentBreak }) => {
          const setter = side === "source" ? setSourceText : setTargetText;
          setter((prev) => {
            if (segmentBreak) {
              if (prev === "" || prev.endsWith("\n\n")) return prev;
              return prev + "\n\n";
            }
            return prev + (delta || "");
          });
        },
        onLog: (entry) => setLogs((l) => [...l.slice(-499), entry]),
        onRawEvent: (ev) =>
          setRawEvents((r) => [...r.slice(-199), { ts: new Date().toISOString(), ev }]),
        onError: (msg) => setError(msg),
      },
    });
  }

  const loadDevices = useCallback(async () => {
    try {
      const list = await engineRef.current.listDevices();
      setDevices(list);
      setSelectedDevice((cur) => cur || (list[0]?.deviceId ?? ""));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    engineRef.current.attachAudio(audioRef.current);
    loadDevices();
    const onOnline = () =>
      setStatus((s) => ({ ...s, network: engineRef.current.active ? "degraded" : "optimal" }));
    const onOffline = () => setStatus((s) => ({ ...s, network: "offline" }));
    navigator.mediaDevices?.addEventListener?.("devicechange", loadDevices);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", loadDevices);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [loadDevices]);

  const startTimer = () => {
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const start = useCallback(async () => {
    setError(null);
    setSourceText("");
    setTargetText("");
    try {
      await engineRef.current.start(selectedDevice, targetLang);
      setActive(true);
      startTimer();
      loadDevices(); // refresh labels now that permission is granted
    } catch (e) {
      setError(mapError(e));
      setActive(false);
    }
  }, [selectedDevice, targetLang, loadDevices]);

  const stop = useCallback(() => {
    engineRef.current.stop();
    setActive(false);
    stopTimer();
  }, []);

  const reset = useCallback(() => {
    engineRef.current.stop();
    setActive(false);
    stopTimer();
    setSourceText("");
    setTargetText("");
    setError(null);
    setDuration(0);
    setRawEvents([]);
    setMuted(false);
    engineRef.current.setMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      engineRef.current.setMuted(next);
      return next;
    });
  }, []);

  const value = {
    status,
    sourceText,
    targetText,
    logs,
    rawEvents,
    error,
    active,
    muted,
    duration,
    devices,
    selectedDevice,
    setSelectedDevice,
    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,
    start,
    stop,
    reset,
    toggleMute,
    clearError: () => setError(null),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio ref={audioRef} autoPlay />
    </Ctx.Provider>
  );
}
