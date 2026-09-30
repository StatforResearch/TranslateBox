import { useLocale } from '../context/LocaleContext';
import { InterfaceLanguage } from '../components/InterfaceLanguage';
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useTranslationSession } from "../context/TranslationContext";

const LEVEL_COLOR = {
  error: "text-red-400",
  warn: "text-amber-400",
  info: "text-emerald-400",
  debug: "text-slate-400",
};

const Field = ({ label, value, ok }) => (
  <div className="rounded-lg bg-[#121824] border border-slate-800 px-4 py-3">
    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">{label}</p>
    <p className={`text-sm font-mono font-semibold mt-1 ${ok ? "text-emerald-400" : "text-slate-200"}`}>{value}</p>
  </div>
);

export default function Debug() {
  const { t } = useLocale();
  const { status, logs, rawEvents, duration, active, error, selectedDevice, devices, metrics, captureSource } = useTranslationSession();
  const [tab, setTab] = useState("logs");
  const logRef = useRef(null);
  const evtRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs, tab]);
  useEffect(() => {
    if (evtRef.current) evtRef.current.scrollTop = evtRef.current.scrollHeight;
  }, [rawEvents, tab]);

  const exportDiagnostics = () => {
    // Explicit allowlist: exclude logs, transcripts, device labels, URLs and credentials.
    const safeMetrics = {};
    for (const key of ["packetLossPct", "jitterMs", "concealedPct", "jitterBufferMs", "rttMs", "latencyMs", "avgLatencyMs"]) {
      safeMetrics[key] = Number.isFinite(metrics[key]) ? metrics[key] : null;
    }
    const report = { capturedAt: new Date().toISOString(), active, durationSeconds: duration,
      reconnectAttempts: status.reconnectCount ?? 0, captureSource, metrics: safeMetrics,
      scope: "OpenAI to operator browser only. Text gap is not audio latency. No listener measurements included." };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type: "application/json"}));
    const link = document.createElement("a"); link.href = url; link.download = "translatebox-diagnostics.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const deviceLabel = devices.find((d) => d.deviceId === selectedDevice)?.label || "Default";

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 font-mono p-4 md:p-8" data-testid="debug-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-wider uppercase">{t("Debug Console")}</h1>
            <p className="text-xs text-slate-500 mt-1">{t("TranslateBox Live — realtime diagnostics")}</p>
          </div>
          <InterfaceLanguage />
          <Link
            to="/"
            data-testid="debug-back-link"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />{t("Console")}</Link>
        </div>

        <button onClick={exportDiagnostics} className="rounded-lg border border-slate-600 px-4 py-3 text-sm">{t("Download diagnostic snapshot")}</button>
        <p className="text-xs text-slate-400">{t("Contains technical measurements only. No transcripts, access codes or audio. Download during an interruption for comparison.")}</p>
        {/* State grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label={t("Session Active")} value={active ? "TRUE" : "FALSE"} ok={active} />
          <Field label={t("Session Duration")} value={`${duration}s`} />
          <Field label={t("Audio Input")} value={status.mic} />
          <Field label={t("OpenAI Session")} value={status.openai} />
          <Field label={t("Translation")} value={status.translation} />
          <Field label={t("Output Audio")} value={status.outputAudio || "idle"} />
          <Field label={t("Network")} value={status.network} />
          <Field label={t("Reconnect Attempts")} value={status.reconnectCount ?? 0} />
          <Field label={t("WebRTC (PC) State")} value={metrics.pcState || "—"} />
          <Field label={t("ICE Connection State")} value={metrics.iceState || "—"} />
          <Field label={t("Dernier \u00e9cart texte")} value={metrics.latencyMs ? `${metrics.latencyMs} ms` : "—"} />
          <Field label={t("\u00c9cart texte moyen")} value={metrics.avgLatencyMs ? `${metrics.avgLatencyMs} ms` : "—"} />
          <Field label={t("Instructions Applied")} value={metrics.instructionsApplied ? "yes" : "no"} />
          <Field label={t("Capture Source")} value={captureSource} />
          <Field label={t("Input Device")} value={deviceLabel} />
          <Field label={t("Last Error")} value={error ? "yes" : "none"} />
        </div>

        <p className="text-sm text-slate-400">{t("L’écart entre transcriptions ne mesure pas le délai audio. Les mesures WebRTC ci-dessous concernent OpenAI → Mac, pas le relais vers le téléphone. Les pourcentages portent sur les deux dernières secondes ; — signifie indisponible.")}</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[["Paquets perdus", "packetLossPct", "%"], ["Gigue réseau", "jitterMs", "ms"], ["Audio reconstitué", "concealedPct", "%"], ["Tampon audio", "jitterBufferMs", "ms"], ["Aller-retour réseau", "rttMs", "ms"]].map(([label, key, unit]) => <Field key={key} label={t(label)} value={Number.isFinite(metrics[key]) ? `${metrics[key].toFixed(1)} ${unit}` : "—"} />)}
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-2">
          {["logs", "events"].map((tabKey) => (
            <button
              key={tabKey}
              data-testid={`debug-tab-${tabKey}`}
              onClick={() => setTab(tabKey)}
              className={`px-4 py-2 rounded-lg text-sm uppercase tracking-wider border transition-colors ${
                tab === tabKey ? "bg-emerald-600 border-emerald-500 text-white" : "border-slate-700 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {tabKey === "logs" ? `${t("WebRTC / Session Log")} (${logs.length})` : `${t("Realtime Events")} (${rawEvents.length})`}
            </button>
          ))}
        </div>

        {tab === "logs" ? (
          <div
            ref={logRef}
            data-testid="debug-log-stream"
            className="rounded-xl bg-black/60 border border-slate-800 p-4 h-[52vh] overflow-y-auto text-xs leading-relaxed space-y-1"
          >
            {logs.length === 0 && <p className="text-slate-600">{t("No log entries yet. Start a session on the console.")}</p>}
            {logs.map((l, i) => (
              <div key={`${l.ts}-${i}`} className="flex gap-3">
                <span className="text-slate-600 shrink-0">{l.ts.split("T")[1]?.replace("Z", "")}</span>
                <span className={`shrink-0 uppercase w-12 ${LEVEL_COLOR[l.level] || "text-slate-400"}`}>{l.level}</span>
                <span className="text-slate-200 break-all">
                  {l.message}
                  {l.data ? " " + JSON.stringify(l.data) : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div
            ref={evtRef}
            data-testid="debug-event-stream"
            className="rounded-xl bg-black/60 border border-slate-800 p-4 h-[52vh] overflow-y-auto text-xs leading-relaxed space-y-1"
          >
            {rawEvents.length === 0 && <p className="text-slate-600">{t("No realtime events captured yet.")}</p>}
            {rawEvents.map((r, i) => (
              <div key={`${r.ts}-${i}`} className="flex gap-3">
                <span className="text-slate-600 shrink-0">{r.ts.split("T")[1]?.replace("Z", "")}</span>
                <span className="text-cyan-400 break-all">{r.ev.type}</span>
                {r.ev.delta && <span className="text-slate-300 break-all">"{r.ev.delta}"</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
