import React from "react";
import { Radio, ArrowRight } from "lucide-react";
import { useTranslationSession } from "../../context/TranslationContext";
import { LanguageCombobox } from "../LanguageCombobox";
import { LevelMeter } from "../LevelMeter";
import { SOURCE_LANGUAGES, TARGET_LANGUAGES } from "../../lib/languages";

// Language selection + audio input/output routing card (operator setup).
export const AudioControlCard = () => {
  const {
    active, sourceLang, setSourceLang, targetLang, setTargetLang,
    devices, selectedDevice, setSelectedDevice,
    outputDevices, selectedOutput, setOutputDevice, outputSupported,
    ambientMode, setAmbientMode, level, testing, testInput, stopTest,
  } = useTranslationSession();

  return (
    <section className="rounded-2xl bg-white/80 dark:bg-[#121824]/70 backdrop-blur-xl border border-slate-200/70 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20 p-4 md:p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1.4fr] gap-3 md:gap-4 items-start">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Source</p>
          <LanguageCombobox options={SOURCE_LANGUAGES} value={sourceLang} onChange={setSourceLang} disabled={active} testId="source-language-select" />
          <p className="mt-1 text-[10px] font-mono text-slate-400">Auto = detected among 70+ languages</p>
        </div>
        <div className="hidden md:flex items-center justify-center pt-[34px] text-slate-400"><ArrowRight className="h-5 w-5" /></div>
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

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3 md:gap-4 items-start pt-3 border-t border-slate-100 dark:border-slate-800/60">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Output · headphones</p>
          <select data-testid="audio-output-select" value={selectedOutput} disabled={!outputSupported} onChange={(e) => setOutputDevice(e.target.value)}
            className="mt-1.5 w-full h-11 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60">
            <option value="">System default output</option>
            {outputDevices.map((d, i) => (<option key={d.deviceId || i} value={d.deviceId}>{d.label || `Output ${i + 1}`}</option>))}
          </select>
          <p className="mt-1 text-[10px] font-mono text-slate-400">{outputSupported ? "Choose your USB / Bluetooth headset for the translated audio." : "iOS/Safari routes to the phone's active output — connect the headset in system settings."}</p>
        </div>
        <div className="flex items-center h-11 mt-[22px]">
          <label className="flex items-center gap-2 cursor-pointer" data-testid="ambient-mode-toggle" title="Disable noise/echo cancellation so a TV, speaker or PA system is not gated as background noise">
            <input type="checkbox" checked={ambientMode} disabled={active} onChange={(e) => setAmbientMode(e.target.checked)} className="h-4 w-4 accent-cyan-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Ambient / TV audio mode</span>
          </label>
        </div>
      </div>
    </section>
  );
};
