import React, { useState } from "react";
import { Play, Square, Mic, MicOff, Volume2, VolumeX, RotateCcw, Radio, Cpu, Wifi, Speaker, AlertTriangle, X, Maximize2, Minimize2, Globe, ArrowRight } from "lucide-react";
import { useTranslationSession } from "../context/TranslationContext";
import { Header } from "../components/Header";
import { StatusIndicator } from "../components/StatusIndicator";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { LanguageCombobox } from "../components/LanguageCombobox";
import { LevelMeter } from "../components/LevelMeter";
import { SettingsDialog } from "../components/SettingsDialog";
import { SOURCE_LANGUAGES, TARGET_LANGUAGES, getTarget, sourceLabel } from "../lib/languages";

const fmt = (s) => {
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  const h = Math.floor(s / 3600);
  return h > 0 ? `${String(h).padStart(2, "0")}:${m}:${sec}` : `${m}:${sec}`;
};

export default function Console() {
  const {
    status, sourceText, targetText, error, active, translationMuted, inputMuted,
    targetLang, setTargetLang, devices, selectedDevice, setSelectedDevice,
    sourceLang, setSourceLang,
    level, testing, testInput, stopTest, duration, metrics,
    start, stop, restart, toggleTranslationMute, toggleInputMute, clearError,
  } = useTranslationSession();

  const [fullscreen, setFullscreen] = useState(false);
  const tgt = getTarget(targetLang);
  const micState = active ? (inputMuted ? "muted" : status.mic) : status.mic;
  const latency = metrics.avgLatencyMs ? (metrics.avgLatencyMs >= 1000 ? `${(metrics.avgLatencyMs / 1000).toFixed(1)}s` : `${metrics.avgLatencyMs}ms`) : "—";

  const panels = (
    <>
      <TranscriptPanel label={`Source — ${sourceLabel(sourceLang)}`} badge={sourceLang === "auto" ? <Globe className="h-3.5 w-3.5" /> : sourceLang.slice(0, 3).toUpperCase()} accent="cyan" text={sourceText} active={active} panelTestId="original-transcript-panel" textTestId="original-transcript-text" />
      <TranscriptPanel label={`Translation — ${tgt.name}`} badge={tgt.code.toUpperCase()} accent="emerald" text={targetText} active={active} panelTestId="translated-transcript-panel" textTestId="translated-transcript-text" />
    </>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0A0D14] text-slate-900 dark:text-slate-100 font-sans">
      <Header />

      {fullscreen && (
        <div className="fixed inset-0 z-[60] bg-slate-100 dark:bg-[#0A0D14] p-4 md:p-8 flex flex-col" data-testid="fullscreen-transcript">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono uppercase tracking-widest text-sm text-slate-500">Auto → {tgt.name} · Live</span>
            <button onClick={() => setFullscreen(false)} data-testid="exit-fullscreen-button" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800"><Minimize2 className="h-4 w-4" /> Exit</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">{panels}</div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        {/* Language + audio control card */}
        <section className="rounded-2xl bg-white/80 dark:bg-[#121824]/70 backdrop-blur-xl border border-slate-200/70 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20 p-4 md:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1.4fr] gap-3 md:gap-4 items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Source</p>
              <LanguageCombobox options={SOURCE_LANGUAGES} value={sourceLang} onChange={setSourceLang} disabled={active} testId="source-language-select" />
              <p className="mt-1 text-[10px] font-mono text-slate-400">Auto = detected among 70+ languages</p>
            </div>
            <div className="hidden md:flex items-center justify-center pb-2.5 text-slate-400"><ArrowRight className="h-5 w-5" /></div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Translate to</p>
              <LanguageCombobox options={TARGET_LANGUAGES} value={targetLang} onChange={setTargetLang} disabled={active} testId="target-language-select" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_auto] gap-3 md:gap-4 items-end pt-1 border-t border-slate-100 dark:border-slate-800/60">
            <div className="pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Audio input</p>
              <select data-testid="audio-device-select" value={selectedDevice} disabled={active} onChange={(e) => setSelectedDevice(e.target.value)}
                className="mt-1.5 w-full h-11 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60">
                {devices.length === 0 && <option value="">Default microphone</option>}
                {devices.map((d, i) => (<option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>))}
              </select>
            </div>
            <div className="pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Input level</p>
              <div className="mt-2.5"><LevelMeter level={level.level} peak={level.peak} active={testing || active} /></div>
            </div>
            <div className="pt-3">
              {!testing ? (
                <button data-testid="test-input-button" onClick={testInput} disabled={active} className="h-11 w-full md:w-auto px-4 flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"><Radio className="h-4 w-4" /> Test</button>
              ) : (
                <button data-testid="stop-test-input-button" onClick={stopTest} className="h-11 w-full md:w-auto px-4 flex items-center justify-center gap-2 rounded-lg border border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-semibold"><Radio className="h-4 w-4 animate-pulse" /> Stop test</button>
              )}
            </div>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div data-testid="error-banner" className="flex items-start gap-3 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm font-medium">{error}</p>
            <button onClick={clearError} data-testid="dismiss-error-button" className="shrink-0 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Primary controls + compact status */}
        <section className="rounded-2xl bg-white/80 dark:bg-[#121824]/70 backdrop-blur-xl border border-slate-200/70 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20 p-4 md:p-5 flex flex-col lg:flex-row items-center gap-4">
          {!active ? (
            <button data-testid="start-translation-button" onClick={start} className="w-full lg:w-auto lg:flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg py-4 px-8 rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center gap-3 justify-center min-h-[56px]"><Play className="h-6 w-6 fill-white" /> START</button>
          ) : (
            <button data-testid="stop-translation-button" onClick={stop} className="w-full lg:w-auto lg:flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-lg py-4 px-8 rounded-xl shadow-[0_0_30px_rgba(239,68,68,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center gap-3 justify-center min-h-[56px]"><Square className="h-6 w-6 fill-white" /> STOP</button>
          )}

          <div className="flex items-center gap-2">
            <button data-testid="mute-input-button" onClick={toggleInputMute} disabled={!active} title="Mute input" className={`h-12 w-12 flex items-center justify-center rounded-xl border transition-colors disabled:opacity-40 ${inputMuted ? "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{inputMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
            <button data-testid="mute-translation-button" onClick={toggleTranslationMute} title="Mute translation" className={`h-12 w-12 flex items-center justify-center rounded-xl border transition-colors ${translationMuted ? "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{translationMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
            <button data-testid="restart-translation-button" onClick={restart} disabled={!active} title="Restart" className="h-12 w-12 flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"><RotateCcw className="h-5 w-5" /></button>
            <SettingsDialog />
          </div>

          <div className="lg:ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <StatusIndicator name="Mic" icon={Mic} state={micState} testId="status-mic-dot" />
              <StatusIndicator name="OpenAI" icon={Cpu} state={status.openai} testId="status-openai-dot" />
              <StatusIndicator name="Live" icon={Radio} state={status.translation} testId="status-translation-dot" />
              <StatusIndicator name="Net" icon={Wifi} state={status.network} testId="status-network-dot" />
            </div>
            <div className="text-right">
              <div data-testid="session-timer-display" className="text-xl font-mono font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(duration)}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400" data-testid="latency-display">~{latency} latency</div>
            </div>
          </div>
        </section>

        {/* Transcript toolbar */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400" data-testid="output-audio-indicator">
            <Speaker className={`h-4 w-4 ${translationMuted ? "text-amber-500" : "text-emerald-500"}`} /> {translationMuted ? "Translated audio muted" : "Translated audio on"}
          </span>
          <button data-testid="fullscreen-transcript-button" onClick={() => setFullscreen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"><Maximize2 className="h-4 w-4" /> Fullscreen</button>
        </div>

        {/* Transcripts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">{panels}</section>

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 font-mono">
          Processed in real time · nothing is recorded or stored by default · use headphones to avoid echo
        </p>
      </main>
    </div>
  );
}
