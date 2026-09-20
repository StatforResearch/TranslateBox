import React from "react";
import { Clock, Timer, RefreshCw, Wifi, Gauge } from "lucide-react";
import { useTranslationSession } from "../context/TranslationContext";

const fmt = (s) => {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

const Stat = ({ icon: Icon, label, value, testId, accent }) => (
  <div className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-[#0F1623] border border-slate-200 dark:border-slate-800 px-3 py-2.5">
    <Icon className={`h-4 w-4 shrink-0 ${accent || "text-slate-400"}`} />
    <div className="flex flex-col leading-tight min-w-0">
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
      <span data-testid={testId} className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100 truncate">{value}</span>
    </div>
  </div>
);

export const SessionInfo = () => {
  const { duration, translatedSeconds, status, metrics } = useTranslationSession();
  const conn = status.openai === "connected" ? "LIVE" : status.openai === "connecting" ? "RECONNECTING…" : status.openai === "error" ? "ERROR" : "STANDBY";
  const connAccent = status.openai === "connected" ? "text-emerald-500" : status.openai === "connecting" ? "text-amber-500" : status.openai === "error" ? "text-red-500" : "text-slate-400";
  const avg = metrics.avgLatencyMs ? (metrics.avgLatencyMs >= 1000 ? `${(metrics.avgLatencyMs / 1000).toFixed(1)} s` : `${metrics.avgLatencyMs} ms`) : "—";

  return (
    <section className="rounded-2xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 p-4">
      <h2 className="text-sm font-bold tracking-widest uppercase text-slate-700 dark:text-slate-200 font-mono mb-3">Session Information</h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <Stat icon={Clock} label="Duration" value={fmt(duration)} testId="session-duration" accent="text-emerald-500" />
        <Stat icon={Timer} label="Translated" value={fmt(translatedSeconds)} testId="translated-minutes" accent="text-cyan-500" />
        <Stat icon={RefreshCw} label="Reconnects" value={status.reconnectCount ?? 0} testId="reconnect-count" />
        <Stat icon={Wifi} label="Connection" value={<span className={connAccent}>{conn}</span>} testId="connection-status" />
        <Stat icon={Gauge} label="Est. avg latency" value={avg} testId="avg-latency" accent="text-amber-500" />
      </div>
    </section>
  );
};
