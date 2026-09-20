import React, { useState } from "react";
import {
  Play, Square, MicOff, Mic, VolumeX, Volume2, RotateCcw, Radio, Cpu, Wifi, Speaker,
  AlertTriangle, X, Maximize2, Minimize2, Download, FileText, Save, Gauge,
} from "lucide-react";
import { useTranslationSession } from "../context/TranslationContext";
import { Header } from "../components/Header";
import { StatusIndicator } from "../components/StatusIndicator";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { AudioSetup } from "../components/AudioSetup";
import { EventProfileDialog } from "../components/EventProfileDialog";
import { SessionInfo } from "../components/SessionInfo";

export default function Console() {
  const {
    status, sourceText, targetText, error, active, translationMuted, inputMuted,
    direction, setDirection, modeKey, setModeKey, customInstructions, setCustomInstructions,
    saveTranscripts, setSaveTranscripts, metrics, profile,
    start, stop, restart, toggleTranslationMute, toggleInputMute, clearError,
    MODES, DIRECTIONS,
  } = useTranslationSession();

  const [fullscreen, setFullscreen] = useState(false);
  const dir = DIRECTIONS[direction];
  const micState = active ? (inputMuted ? "muted" : status.mic) : status.mic;

  const latencyText = metrics.avgLatencyMs
    ? metrics.avgLatencyMs >= 1000
      ? `${(metrics.avgLatencyMs / 1000).toFixed(1)} s`
      : `${metrics.avgLatencyMs} ms`
    : "—";

  const buildTranscript = () => {
    const now = new Date();
    return [
      "TranslateBox Live — Transcript",
      `Event: ${profile.eventName || "—"}`,
      `Organization: ${profile.organization || "—"}`,
      `Date/time: ${now.toLocaleString()}`,
      `Direction: ${dir.badge}`,
      `Source language: ${dir.source}`,
      `Target language: ${dir.target}`,
      "",
      `===== SOURCE — ${dir.source.toUpperCase()} =====`,
      sourceText || "(empty)",
      "",
      `===== TRANSLATION — ${dir.target.toUpperCase()} =====`,
      targetText || "(empty)",
      "",
    ].join("\n");
  };

  const exportTxt = () => {
    const blob = new Blob([buildTranscript()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translatebox-${(profile.eventName || "session").replace(/\s+/g, "-")}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    w.document.write(`<html><head><title>TranslateBox Transcript</title>
      <style>body{font-family:-apple-system,Segoe UI,sans-serif;padding:32px;color:#0f172a;line-height:1.6}
      h1{font-size:20px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.1em;color:#0891b2;margin-top:24px}
      .meta{font-size:12px;color:#475569}pre{white-space:pre-wrap;font-family:inherit;font-size:14px}</style></head><body>
      <h1>TranslateBox Live — Transcript</h1>
      <div class="meta">Event: ${esc(profile.eventName || "—")}<br/>Organization: ${esc(profile.organization || "—")}<br/>
      Date/time: ${new Date().toLocaleString()}<br/>Direction: ${dir.badge} (${dir.source} → ${dir.target})</div>
      <h2>Source — ${dir.source}</h2><pre>${esc(sourceText || "(empty)")}</pre>
      <h2>Translation — ${dir.target}</h2><pre>${esc(targetText || "(empty)")}</pre>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const dirBtn = (key) => `flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold uppercase tracking-wide text-sm border-2 transition-colors disabled:opacity-50 ${
    direction === key
      ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400"
      : "border-slate-300 dark:border-slate-700 text-slate-500 hover:border-slate-400"
  }`;

  const transcriptPanels = (
    <>
      <TranscriptPanel label={`Source — ${dir.source}`} badge={direction === "fr-en" ? "FR" : "EN"} accent="cyan" text={sourceText} active={active} panelTestId="original-transcript-panel" textTestId="original-transcript-text" />
      <TranscriptPanel label={`Translation — ${dir.target}`} badge={dir.targetCode.toUpperCase()} accent="emerald" text={targetText} active={active} panelTestId="translated-transcript-panel" textTestId="translated-transcript-text" />
    </>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0A0D14] text-slate-900 dark:text-slate-100 font-sans">
      <Header />

      {/* Fullscreen transcript overlay */}
      {fullscreen && (
        <div className="fixed inset-0 z-[60] bg-slate-100 dark:bg-[#0A0D14] p-4 md:p-8 flex flex-col" data-testid="fullscreen-transcript">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono uppercase tracking-widest text-sm text-slate-500">{dir.badge} · Live Transcript</span>
            <button onClick={() => setFullscreen(false)} data-testid="exit-fullscreen-button" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800">
              <Minimize2 className="h-4 w-4" /> Exit
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">{transcriptPanels}</div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-5">
        {/* Summary bar */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Event</p>
            <p data-testid="summary-event" className="text-sm md:text-base font-bold truncate">{profile.eventName || "Untitled event"}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Translation</p>
            <p data-testid="summary-direction" className="text-sm md:text-base font-bold">{dir.badge}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Mode</p>
            <p data-testid="summary-mode" className="text-sm md:text-base font-bold truncate">{MODES[modeKey].label}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Est. latency</p>
              <p data-testid="latency-display" className="text-sm md:text-base font-bold">{latencyText}</p>
            </div>
            <Gauge className="h-5 w-5 text-amber-500" />
          </div>
        </section>

        {/* Status row */}
        <section className="rounded-2xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <StatusIndicator name="Audio Input" icon={Mic} state={micState} testId="status-mic-dot" />
            <StatusIndicator name="OpenAI" icon={Cpu} state={status.openai} testId="status-openai-dot" />
            <StatusIndicator name="Translation" icon={Radio} state={status.translation} testId="status-translation-dot" />
            <StatusIndicator name="Output Audio" icon={Speaker} state={translationMuted ? "muted" : status.outputAudio} testId="status-output-dot" />
            <StatusIndicator name="Network" icon={Wifi} state={status.network} testId="status-network-dot" />
          </div>
        </section>

        {/* Configuration: direction + mode + profile */}
        <section className="rounded-2xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 p-4 md:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono mb-1.5">Translation Direction</p>
              <div className="flex gap-3">
                <button data-testid="direction-fr-en" onClick={() => setDirection("fr-en")} disabled={active} className={dirBtn("fr-en")}>🇫🇷 FR → EN 🇬🇧</button>
                <button data-testid="direction-en-fr" onClick={() => setDirection("en-fr")} disabled={active} className={dirBtn("en-fr")}>🇬🇧 EN → FR 🇫🇷</button>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono mb-1.5">Translation Mode</p>
              <div className="flex flex-wrap gap-2">
                {Object.values(MODES).map((m) => (
                  <button
                    key={m.key}
                    data-testid={`mode-${m.key.toLowerCase()}`}
                    onClick={() => setModeKey(m.key)}
                    disabled={active}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide border transition-colors disabled:opacity-50 ${modeKey === m.key ? "bg-cyan-500/15 border-cyan-500 text-cyan-600 dark:text-cyan-400" : "border-slate-300 dark:border-slate-700 text-slate-500 hover:border-slate-400"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <EventProfileDialog />
            </div>
          </div>
          {modeKey === "CUSTOM" && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Custom Instructions</label>
              <textarea
                data-testid="custom-instructions-input"
                value={customInstructions}
                disabled={active}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={3}
                placeholder="Write your own interpreter instructions…"
                className="mt-1 w-full rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              />
            </div>
          )}
          {metrics.instructionsApplied === false && active && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">Note: the current translation model applied the base interpreter behavior; custom vocabulary is included in exports.</p>
          )}
        </section>

        {/* Audio setup */}
        <AudioSetup />

        {/* Error banner */}
        {error && (
          <div data-testid="error-banner" className="flex items-start gap-3 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm font-medium">{error}</p>
            <button onClick={clearError} data-testid="dismiss-error-button" className="shrink-0 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Controls */}
        <section className="rounded-2xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 p-4 md:p-5 shadow-xl flex flex-wrap items-stretch gap-3">
          {!active ? (
            <button data-testid="start-translation-button" onClick={start} className="flex-1 min-w-[220px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg md:text-xl py-4 px-8 rounded-xl shadow-lg shadow-emerald-900/30 active:scale-[0.98] transition-transform flex items-center gap-3 justify-center min-h-[56px]">
              <Play className="h-6 w-6 fill-white" /> START
            </button>
          ) : (
            <button data-testid="stop-translation-button" onClick={stop} className="flex-1 min-w-[160px] bg-red-600 hover:bg-red-500 text-white font-bold text-lg md:text-xl py-4 px-8 rounded-xl shadow-lg shadow-red-900/30 active:scale-[0.98] transition-transform flex items-center gap-3 justify-center min-h-[56px]">
              <Square className="h-6 w-6 fill-white" /> STOP
            </button>
          )}
          <button data-testid="mute-input-button" onClick={toggleInputMute} disabled={!active} className={`flex items-center gap-2 justify-center font-semibold px-5 rounded-xl border transition-colors min-h-[56px] disabled:opacity-40 ${inputMuted ? "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400" : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
            {inputMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />} MUTE INPUT
          </button>
          <button data-testid="mute-translation-button" onClick={toggleTranslationMute} className={`flex items-center gap-2 justify-center font-semibold px-5 rounded-xl border transition-colors min-h-[56px] ${translationMuted ? "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400" : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
            {translationMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />} MUTE TRANSLATION
          </button>
          <button data-testid="restart-translation-button" onClick={restart} disabled={!active} className="flex items-center gap-2 justify-center font-semibold px-5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[56px] disabled:opacity-40">
            <RotateCcw className="h-5 w-5" /> RESTART
          </button>
          <div className="flex items-center gap-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 min-h-[56px]" data-testid="translated-audio-status">
            <Speaker className={`h-5 w-5 ${translationMuted ? "text-amber-500" : "text-emerald-500"}`} />
            <span className="text-xs font-mono uppercase tracking-wide">{translationMuted ? "Translated: MUTED" : "Translated: ON"}</span>
          </div>
        </section>

        {/* Transcript toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer" data-testid="save-transcripts-toggle" >
            <input type="checkbox" checked={saveTranscripts} onChange={(e) => setSaveTranscripts(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300"><Save className="h-4 w-4" /> Save transcripts (default OFF)</span>
          </label>
          <div className="flex items-center gap-2">
            <button data-testid="export-txt-button" onClick={exportTxt} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"><Download className="h-4 w-4" /> Export TXT</button>
            <button data-testid="export-pdf-button" onClick={exportPdf} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"><FileText className="h-4 w-4" /> Export PDF</button>
            <button data-testid="fullscreen-transcript-button" onClick={() => setFullscreen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"><Maximize2 className="h-4 w-4" /> Fullscreen</button>
          </div>
        </div>

        {/* Transcripts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">{transcriptPanels}</section>

        <SessionInfo />

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 font-mono">
          Audio & transcripts are processed in real time and are not recorded or stored unless you enable "Save transcripts". Use headphones to prevent echo.
        </p>
      </main>
    </div>
  );
}
