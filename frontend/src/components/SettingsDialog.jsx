import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "./ui/dialog";
import { SlidersHorizontal, Download, FileText, Save } from "lucide-react";
import { useTranslationSession } from "../context/TranslationContext";
import { getTarget } from "../lib/languages";

const Field = ({ label, hint, value, onChange, textarea, disabled, testId }) => (
  <div>
    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">{label}</label>
    {hint && <p className="text-[10px] text-slate-400 dark:text-slate-600 mb-1">{hint}</p>}
    {textarea ? (
      <textarea data-testid={testId} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} rows={2}
        className="mt-1 w-full rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 font-mono" />
    ) : (
      <input data-testid={testId} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-10 rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60" />
    )}
  </div>
);

export const SettingsDialog = () => {
  const {
    MODES, modeKey, setModeKey, customInstructions, setCustomInstructions,
    profile, setProfile, active, saveTranscripts, setSaveTranscripts,
    sourceText, targetText, targetLang,
  } = useTranslationSession();
  const set = (k) => (v) => setProfile((p) => ({ ...p, [k]: v }));

  const buildText = () => {
    const tgt = getTarget(targetLang);
    return [
      "TranslateBox Live — Transcript",
      `Event: ${profile.eventName || "—"}`,
      `Organization: ${profile.organization || "—"}`,
      `Date/time: ${new Date().toLocaleString()}`,
      `Source: Auto-detected · Target: ${tgt.name}`,
      "",
      "===== SOURCE =====",
      sourceText || "(empty)",
      "",
      `===== TRANSLATION — ${tgt.name.toUpperCase()} =====`,
      targetText || "(empty)",
      "",
    ].join("\n");
  };
  const exportTxt = () => {
    const blob = new Blob([buildText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translatebox-${(profile.eventName || "session").replace(/\s+/g, "-")}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportPdf = () => {
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const tgt = getTarget(targetLang);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>TranslateBox Transcript</title><style>body{font-family:-apple-system,Segoe UI,sans-serif;padding:32px;color:#0f172a;line-height:1.6}h1{font-size:20px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#0891b2;margin-top:22px}.m{font-size:12px;color:#475569}pre{white-space:pre-wrap;font:inherit;font-size:14px}</style></head><body><h1>TranslateBox Live — Transcript</h1><div class="m">Event: ${esc(profile.eventName || "—")}<br/>Organization: ${esc(profile.organization || "—")}<br/>${esc(new Date().toLocaleString())}<br/>Target: ${esc(tgt.name)}</div><h2>Source</h2><pre>${esc(sourceText || "(empty)")}</pre><h2>Translation — ${esc(tgt.name)}</h2><pre>${esc(targetText || "(empty)")}</pre></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const w = window.open(url, "_blank");
    if (!w) {
      URL.revokeObjectURL(url);
      return;
    }
    w.addEventListener("load", () => {
      w.focus();
      w.print();
    });
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" data-testid="settings-button" title="Settings" className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto bg-white dark:bg-[#121824] border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="font-mono tracking-wide uppercase">Settings</DialogTitle>
          <DialogDescription className="sr-only">Translation mode, event profile, transcript privacy and export.</DialogDescription>
        </DialogHeader>

        {/* Mode */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono mb-1.5">Translation Mode</p>
          <div className="flex flex-wrap gap-2">
            {Object.values(MODES).map((m) => (
              <button key={m.key} data-testid={`mode-${m.key.toLowerCase()}`} onClick={() => setModeKey(m.key)} disabled={active}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide border transition-colors disabled:opacity-50 ${modeKey === m.key ? "bg-cyan-500/15 border-cyan-500 text-cyan-600 dark:text-cyan-400" : "border-slate-300 dark:border-slate-700 text-slate-500 hover:border-slate-400"}`}>
                {m.label}
              </button>
            ))}
          </div>
          {modeKey === "CUSTOM" && (
            <textarea data-testid="custom-instructions-input" value={customInstructions} disabled={active} onChange={(e) => setCustomInstructions(e.target.value)} rows={3} placeholder="Your own interpreter instructions…"
              className="mt-2 w-full rounded-lg bg-slate-100 dark:bg-[#0F1623] border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60" />
          )}
        </div>

        {/* Event profile */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">Event Profile <span className="normal-case tracking-normal text-slate-400">(optional · one item per line)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Event Name" value={profile.eventName} onChange={set("eventName")} disabled={active} testId="profile-event-name" />
            <Field label="Organization" value={profile.organization} onChange={set("organization")} disabled={active} testId="profile-organization" />
          </div>
          <Field label="Speakers" textarea value={profile.speakers} onChange={set("speakers")} disabled={active} testId="profile-speakers" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Names / Proper Nouns" textarea value={profile.vocabNames} onChange={set("vocabNames")} disabled={active} testId="profile-vocab-names" />
            <Field label="Biblical Terms" textarea value={profile.vocabBiblical} onChange={set("vocabBiblical")} disabled={active} testId="profile-vocab-biblical" />
            <Field label="Technical Terms" textarea value={profile.vocabTechnical} onChange={set("vocabTechnical")} disabled={active} testId="profile-vocab-technical" />
            <Field label="Acronyms" textarea value={profile.vocabAcronyms} onChange={set("vocabAcronyms")} disabled={active} testId="profile-vocab-acronyms" />
          </div>
          <Field label="Places" textarea value={profile.vocabPlaces} onChange={set("vocabPlaces")} disabled={active} testId="profile-vocab-places" />
          <Field label="Additional Instructions" textarea value={profile.additional} onChange={set("additional")} disabled={active} testId="profile-additional" />
        </div>

        {/* Privacy + export */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer" data-testid="save-transcripts-toggle">
            <input type="checkbox" checked={saveTranscripts} onChange={(e) => setSaveTranscripts(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
            <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300"><Save className="h-4 w-4" /> Save transcripts (default OFF)</span>
          </label>
          <div className="flex items-center gap-2">
            <button data-testid="export-txt-button" onClick={exportTxt} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"><Download className="h-4 w-4" /> TXT</button>
            <button data-testid="export-pdf-button" onClick={exportPdf} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"><FileText className="h-4 w-4" /> PDF</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
