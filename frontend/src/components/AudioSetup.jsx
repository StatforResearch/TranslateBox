import React from "react";
import { Mic, Activity, Radio, MonitorSpeaker, FlaskConical } from "lucide-react";
import { useTranslationSession } from "../context/TranslationContext";
import { LevelMeter } from "./LevelMeter";

export const AudioSetup = () => {
  const {
    devices, selectedDevice, setSelectedDevice, captureSource, setCaptureSource,
    level, testing, testInput, stopTest, active, status, inputMuted,
  } = useTranslationSession();

  const labelClass = "text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono";
  const inputStatus = inputMuted ? "Muted" : status.mic === "active" ? "Live" : status.mic === "denied" ? "Denied" : status.mic === "error" ? "Disconnected" : "Idle";
  const statusColor = inputMuted ? "text-amber-500" : status.mic === "active" ? "text-emerald-500" : status.mic === "denied" || status.mic === "error" ? "text-red-500" : "text-slate-400";

  return (
    <section
      data-testid="audio-setup-section"
      className="rounded-2xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 p-4 md:p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <MonitorSpeaker className="h-4 w-4 text-emerald-500" />
        <h2 className="text-sm font-bold tracking-widest uppercase text-slate-700 dark:text-slate-200 font-mono">Audio Setup</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="audio-device" className={labelClass}>Input Device</label>
          <select
            id="audio-device"
            data-testid="audio-device-select"
            value={selectedDevice}
            disabled={active || captureSource === "display"}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="mt-1.5 w-full h-11 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          >
            {devices.length === 0 && <option value="">Default microphone</option>}
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>
            ))}
          </select>
          <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-600 font-mono">Built-in mic, USB microphone, USB / USB-C audio interface, or conference mixer.</p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              data-testid="capture-mic-button"
              onClick={() => setCaptureSource("mic")}
              disabled={active}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide border transition-colors disabled:opacity-50 ${captureSource === "mic" ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-slate-300 dark:border-slate-700 text-slate-500"}`}
            >
              <Mic className="h-3.5 w-3.5" /> Microphone / USB
            </button>
            <button
              type="button"
              data-testid="capture-tab-button"
              onClick={() => setCaptureSource("display")}
              disabled={active}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide border transition-colors disabled:opacity-50 ${captureSource === "display" ? "bg-cyan-500/15 border-cyan-500 text-cyan-600 dark:text-cyan-400" : "border-slate-300 dark:border-slate-700 text-slate-500"}`}
            >
              <FlaskConical className="h-3.5 w-3.5" /> Tab / Screen
              <span className="ml-1 text-[9px] px-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">EXPERIMENTAL</span>
            </button>
          </div>
          {captureSource === "display" && (
            <p className="mt-2 text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">Desktop only. When prompted, pick a tab and enable "Share tab audio" (e.g. a YouTube livestream).</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className={labelClass}>Input Status</span>
            <span className={`text-xs font-mono font-bold ${statusColor}`} data-testid="input-status-text">{inputStatus}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400 shrink-0" />
            <LevelMeter level={level.level} peak={level.peak} active={testing || active} />
          </div>
          <div className="mt-3">
            {!testing ? (
              <button
                type="button"
                data-testid="test-input-button"
                onClick={testInput}
                disabled={active}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <Radio className="h-4 w-4" /> TEST INPUT
              </button>
            ) : (
              <button
                type="button"
                data-testid="stop-test-input-button"
                onClick={stopTest}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold hover:bg-amber-500/20 transition-colors"
              >
                <Radio className="h-4 w-4 animate-pulse" /> STOP TEST
              </button>
            )}
            <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-600 font-mono">TEST INPUT shows the meter without sending audio to OpenAI. No feedback is produced.</p>
          </div>
        </div>
      </div>
    </section>
  );
};
