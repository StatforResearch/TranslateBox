import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { TranslationEngine } from "../lib/translationEngine";
import { MODES, EMPTY_PROFILE, compileInstructions } from "../lib/profiles";
import { getTarget } from "../lib/languages";
import { usePersistentState } from "../hooks/usePersistentState";
import { useBroadcast } from "../hooks/useBroadcast";

import { API } from "../lib/api";

const Ctx = createContext(null);
export const useTranslationSession = () => useContext(Ctx);

const INITIAL_STATUS = {
  mic: "idle",
  openai: "standby",
  translation: "standby",
  outputAudio: "idle",
  network: "optimal",
  reconnectCount: 0,
};

function mapError(err) {
  const msg = err?.message || String(err);
  const parts = msg.split(":");
  const code = parts[0];
  const detail = parts.slice(2).join(":");
  switch (code) {
    case "MIC_PERMISSION":
      if (parts[1] === "NotFoundError") return "No microphone was found. Connect an audio input, then choose it in Audio input.";
      if (parts[1] === "NotReadableError") return "The microphone is busy or unavailable. Close other audio applications and retry.";
      if (parts[1] === "OverconstrainedError") return "The selected microphone is no longer available. Choose another Audio input.";
      return "Microphone access was denied. Allow it in the browser and macOS privacy settings, then retry Test.";
    case "NO_AUDIO_INPUT":
      return detail || "No audio input detected. Check your microphone or USB audio interface.";
    case "SESSION_TOKEN":
      return `Could not start a translation session. ${detail || "The OpenAI API key may be missing on the server."}`;
    case "OPENAI_CONNECT": {
      const st = parts[1];
      if (st === "429") return "The translation service is temporarily unavailable (quota limit reached). Please try again later.";
      return `Could not connect to the translation service (code ${st}). Please try again.`;
    }
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
  const [translationMuted, setTranslationMuted] = useState(false);
  const [inputMuted, setInputMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [translatedSeconds, setTranslatedSeconds] = useState(0);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [outputDevices, setOutputDevices] = useState([]);
  const [selectedOutput, setSelectedOutput] = usePersistentState("tbl-output", "");
  const [ambientMode, setAmbientMode] = usePersistentState("tbl-ambient", false);
  const [captureSource, setCaptureSource] = useState("mic"); // 'mic' | 'display'
  const [sourceLang, setSourceLang] = usePersistentState("tbl-source", "auto");
  const [targetLang, setTargetLang] = usePersistentState("tbl-target", "en");
  const [modeKey, setModeKey] = usePersistentState("tbl-mode", "GENERAL");
  const [customInstructions, setCustomInstructions] = usePersistentState("tbl-custom", "");
  const [profile, setProfile] = usePersistentState("tbl-profile", EMPTY_PROFILE);
  const [saveTranscripts, setSaveTranscripts] = usePersistentState("tbl-save", false);
  const [level, setLevel] = useState({ level: 0, peak: 0 });
  const [testing, setTesting] = useState(false);
  const [metrics, setMetrics] = useState({ latencyMs: null, avgLatencyMs: null, instructionsApplied: false, pcState: "", iceState: "" });

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
        onRawEvent: (ev) => setRawEvents((r) => [...r.slice(-199), { ts: new Date().toISOString(), ev }]),
        onError: (msg) => setError(msg),
        onLevel: (lv) => setLevel(lv),
        onMetrics: (m) => setMetrics((prev) => ({ ...prev, ...m })),
      },
    });
  }

  const setOutputDevice = useCallback((id) => {
    setSelectedOutput(id);
    engineRef.current.setOutputDevice(id);
  }, [setSelectedOutput]);

  const loadDevices = useCallback(async () => {
    try {
      const list = await engineRef.current.listDevices();
      setDevices(list);
      setSelectedDevice((cur) => cur || (list[0]?.deviceId ?? ""));
      const outs = await engineRef.current.listOutputDevices();
      setOutputDevices(outs);
    } catch (err) {
      console.error("[TranslationContext] device enumeration failed", err);
    }
  }, []);

  useEffect(() => {
    engineRef.current.attachAudio(audioRef.current);
    if (selectedOutput) engineRef.current.setOutputDevice(selectedOutput);
    loadDevices();
    const onOnline = () => setStatus((s) => ({ ...s, network: engineRef.current.active ? "degraded" : "optimal" }));
    const onOffline = () => setStatus((s) => ({ ...s, network: "offline" }));
    const onDeviceChange = async () => {
      await loadDevices();
      // If the active input device vanished, notify the operator.
      const eng = engineRef.current;
      if (eng.active && eng.captureSource === "mic" && selectedDevice) {
        const list = await eng.listDevices();
        if (!list.find((d) => d.deviceId === selectedDevice)) {
          setError("The selected audio input device was disconnected. Choose another input device.");
          setStatus((s) => ({ ...s, mic: "error" }));
        }
      }
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDevices, selectedDevice]);

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
      setStatus((s) => {
        if (s.translation === "interpreting") setTranslatedSeconds((t) => t + 1);
        return s;
      });
    }, 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const start = useCallback(async () => {
    if (engineRef.current.active) return true;
    setError(null);
    setSourceText("");
    setTargetText("");
    setDuration(0);
    setTranslatedSeconds(0);
    setTesting(false);
    const targetName = getTarget(targetLang).name;
    const instructions = compileInstructions({ modeKey, customText: customInstructions, targetName, profile });
    try {
      await engineRef.current.start({
        deviceId: selectedDevice,
        source: captureSource,
        targetLanguage: targetLang,
        instructions,
        ambient: ambientMode,
      });
      if (!engineRef.current.active) return false;
      setActive(true);
      startTimer();
      loadDevices();
      return true;
    } catch (e) {
      setError(mapError(e));
      setActive(false);
      return false;
    }
  }, [selectedDevice, captureSource, targetLang, modeKey, customInstructions, profile, ambientMode, loadDevices]);

  const stop = useCallback(() => {
    engineRef.current.stop();
    setActive(false);
    stopTimer();
    if (!saveTranscripts) {
      setSourceText("");
      setTargetText("");
    }
  }, [saveTranscripts]);

  const restart = useCallback(async () => {
    engineRef.current.stop();
    setActive(false);
    stopTimer();
    await new Promise((r) => setTimeout(r, 300));
    await start();
  }, [start]);

  const reset = useCallback(() => {
    engineRef.current.stop();
    setActive(false);
    stopTimer();
    setSourceText("");
    setTargetText("");
    setError(null);
    setDuration(0);
    setTranslatedSeconds(0);
    setRawEvents([]);
    setTranslationMuted(false);
    setInputMuted(false);
    engineRef.current.setTranslationMuted(false);
    setMetrics({ latencyMs: null, avgLatencyMs: null, instructionsApplied: false, pcState: "", iceState: "" });
  }, []);

  const toggleTranslationMute = useCallback(() => {
    setTranslationMuted((m) => {
      const next = !m;
      engineRef.current.setTranslationMuted(next);
      return next;
    });
  }, []);

  const toggleInputMute = useCallback(() => {
    setInputMuted((m) => {
      const next = !m;
      engineRef.current.setInputMuted(next);
      return next;
    });
  }, []);

  const testInput = useCallback(async () => {
    setError(null);
    try {
      await engineRef.current.testInput(selectedDevice, captureSource, ambientMode);
      setTesting(true);
    } catch (e) {
      setError(mapError(e));
      setTesting(false);
    }
  }, [selectedDevice, captureSource, ambientMode]);

  const stopTest = useCallback(async () => {
    await engineRef.current.stopTest();
    setTesting(false);
  }, []);

  const broadcast = useBroadcast({ API, engineRef, targetLang, profile, start, stop, setError, targetText, active, setTargetLang });

  useEffect(() => () => {
    engineRef.current.stop();
    engineRef.current.stopTest();
    clearInterval(timerRef.current);
  }, []);

  const value = {
    status, sourceText, targetText, logs, rawEvents, error, active,
    translationMuted, inputMuted, duration, translatedSeconds,
    devices, selectedDevice, setSelectedDevice, captureSource, setCaptureSource,
    outputDevices, selectedOutput, setOutputDevice, outputSupported: engineRef.current.outputSupported(),
    ambientMode, setAmbientMode,
    targetLang, setTargetLang, modeKey, setModeKey, customInstructions, setCustomInstructions,
    sourceLang, setSourceLang,
    profile, setProfile, saveTranscripts, setSaveTranscripts,
    level, testing, metrics,
    start, stop, restart, reset,
    ...broadcast,
    toggleTranslationMute, toggleInputMute, testInput, stopTest,
    clearError: () => setError(null),
    MODES,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio ref={audioRef} autoPlay />
    </Ctx.Provider>
  );
}
