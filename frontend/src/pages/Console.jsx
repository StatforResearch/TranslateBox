import React from "react";
import { Play, Square, Mic, VolumeX, Volume2, RotateCcw, Radio, Cpu, Wifi, Languages, AlertTriangle, X } from "lucide-react";
import { useTranslationSession } from "../context/TranslationContext";
import { Header } from "../components/Header";
import { StatusIndicator } from "../components/StatusIndicator";
import { TranscriptPanel } from "../components/TranscriptPanel";

const fmt = (s) => {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

export default function Console() {
  const {
    status, sourceText, targetText, error, active, muted, duration,
    devices, selectedDevice, setSelectedDevice, start, stop, reset, toggleMute, clearError,
  } = useTranslationSession();

  const micState = active ? (muted ? "muted" : status.mic) : status.mic;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0A0D14] text-slate-900 dark:text-slate-100 font-sans">
      <Header />

      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-5 md:space-y-6 flex flex-col">
        {/* Language + device row */}
        <section className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-4">
          <div className="rounded-xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Source</p>
            <p className="text-xl md:text-2xl font-bold mt-1 flex items-center gap-2">🇫🇷 French</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Target</p>
            <p className="text-xl md:text-2xl font-bold mt-1 flex items-center gap-2">🇬🇧 English</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 px-5 py-4">
            <label htmlFor="audio-device" className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">
              Audio Input Device
            </label>
            <select
              id="audio-device"
              data-testid="audio-device-select"
              value={selectedDevice}
              disabled={active}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="mt-1.5 w-full h-11 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            >
              {devices.length === 0 && <option value="">Default microphone</option>}
              {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Microphone ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Status bar */}
        <section className="rounded-xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 p-4 flex flex-col lg:flex-row items-stretch lg:items-center gap-4 justify-between">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1">
            <StatusIndicator name="Microphone" icon={Mic} state={micState} testId="status-mic-dot" />
            <StatusIndicator name="OpenAI" icon={Cpu} state={status.openai} testId="status-openai-dot" />
            <StatusIndicator name="Translation" icon={Radio} state={status.translation} testId="status-translation-dot" />
            <StatusIndicator name="Network" icon={Wifi} state={status.network} testId="status-network-dot" />
          </div>
          <div className="flex flex-col items-center lg:items-end justify-center px-4 lg:border-l border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Session</span>
            <span data-testid="session-timer-display" className="text-2xl md:text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
              {fmt(duration)}
            </span>
          </div>
        </section>

        {/* Error banner */}
        {error && (
          <div data-testid="error-banner" className="flex items-start gap-3 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm font-medium">{error}</p>
            <button onClick={clearError} data-testid="dismiss-error-button" className="shrink-0 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Controls */}
        <section className="rounded-2xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 p-4 md:p-5 shadow-xl flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
          {!active ? (
            <button
              data-testid="start-translation-button"
              onClick={start}
              className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg md:text-xl py-4 px-8 rounded-xl shadow-lg shadow-emerald-900/30 active:scale-[0.98] transition-transform flex items-center gap-3 justify-center min-h-[56px]"
            >
              <Play className="h-6 w-6 fill-white" /> START TRANSLATION
            </button>
          ) : (
            <button
              data-testid="stop-translation-button"
              onClick={stop}
              className="flex-1 md:flex-none bg-red-600 hover:bg-red-500 text-white font-bold text-lg md:text-xl py-4 px-8 rounded-xl shadow-lg shadow-red-900/30 active:scale-[0.98] transition-transform flex items-center gap-3 justify-center min-h-[56px]"
            >
              <Square className="h-6 w-6 fill-white" /> STOP
            </button>
          )}

          <button
            data-testid="mute-audio-button"
            onClick={toggleMute}
            className={`flex items-center gap-2.5 justify-center font-semibold px-5 py-3 rounded-xl border transition-colors min-h-[56px] ${
              muted
                ? "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            {muted ? "TRANSLATED AUDIO MUTED" : "MUTE TRANSLATED AUDIO"}
          </button>

          <button
            data-testid="reset-session-button"
            onClick={reset}
            className="flex items-center gap-2.5 justify-center font-semibold px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[56px]"
          >
            <RotateCcw className="h-5 w-5" /> RESET SESSION
          </button>

          <div className="hidden md:flex items-center gap-2 ml-auto text-slate-400 dark:text-slate-500 text-xs font-mono uppercase tracking-widest">
            <Languages className="h-4 w-4" /> FR → EN
          </div>
        </section>

        {/* Transcripts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <TranscriptPanel
            label="Original — French"
            badge="FR"
            accent="cyan"
            text={sourceText}
            active={active}
            panelTestId="original-transcript-panel"
            textTestId="original-transcript-text"
          />
          <TranscriptPanel
            label="Translation — English"
            badge="EN"
            accent="emerald"
            text={targetText}
            active={active}
            panelTestId="translated-transcript-panel"
            textTestId="translated-transcript-text"
          />
        </section>

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 font-mono pt-1">
          Audio & transcripts are processed in real time and are not recorded or stored. Use headphones to prevent echo.
        </p>
      </main>
    </div>
  );
}
