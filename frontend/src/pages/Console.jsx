import React, { useState } from "react";
import { Speaker, AlertTriangle, X, Maximize2, Minimize2, Globe } from "lucide-react";
import { useTranslationSession } from "../context/TranslationContext";
import { Header } from "../components/Header";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { BroadcastPanel } from "../components/BroadcastPanel";
import { AudioControlCard } from "../components/console/AudioControlCard";
import { TransportControls } from "../components/console/TransportControls";
import { getTarget, sourceLabel } from "../lib/languages";

export default function Console() {
  const { sourceText, targetText, error, active, translationMuted, targetLang, sourceLang, clearError } = useTranslationSession();
  const [fullscreen, setFullscreen] = useState(false);
  const tgt = getTarget(targetLang);

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
        <AudioControlCard />

        {error && (
          <div data-testid="error-banner" className="flex items-start gap-3 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm font-medium">{error}</p>
            <button onClick={clearError} data-testid="dismiss-error-button" className="shrink-0 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
          </div>
        )}

        <TransportControls />

        <BroadcastPanel />

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400" data-testid="output-audio-indicator">
            <Speaker className={`h-4 w-4 ${translationMuted ? "text-amber-500" : "text-emerald-500"}`} /> {translationMuted ? "Translated audio muted" : "Translated audio on"}
          </span>
          <button data-testid="fullscreen-transcript-button" onClick={() => setFullscreen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"><Maximize2 className="h-4 w-4" /> Fullscreen</button>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">{panels}</section>

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 font-mono">
          Processed in real time · nothing is recorded or stored by default · use headphones to avoid echo
        </p>
      </main>
    </div>
  );
}
