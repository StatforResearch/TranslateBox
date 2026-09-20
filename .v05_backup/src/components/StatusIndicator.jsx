import React from "react";

// state -> {label, tone}. tone drives dot color + ambient glow.
const MAP = {
  active: ["ACTIVE", "emerald"], connected: ["CONNECTED", "emerald"], optimal: ["OPTIMAL", "emerald"],
  interpreting: ["LIVE", "cyan"],
  connecting: ["CONNECTING", "amber"], degraded: ["DEGRADED", "amber"], muted: ["MUTED", "amber"],
  denied: ["DENIED", "rose"], error: ["ERROR", "rose"], offline: ["OFFLINE", "rose"],
  idle: ["IDLE", "slate"], standby: ["STANDBY", "slate"],
};

const TONE = {
  emerald: { dot: "bg-emerald-400", glow: "shadow-[0_0_10px_2px_rgba(16,185,129,0.55)]", text: "text-emerald-500 dark:text-emerald-400" },
  cyan: { dot: "bg-cyan-400", glow: "shadow-[0_0_10px_2px_rgba(6,182,212,0.55)]", text: "text-cyan-500 dark:text-cyan-400" },
  amber: { dot: "bg-amber-400", glow: "shadow-[0_0_10px_2px_rgba(245,158,11,0.55)]", text: "text-amber-500 dark:text-amber-400" },
  rose: { dot: "bg-rose-500", glow: "shadow-[0_0_10px_2px_rgba(239,68,68,0.55)]", text: "text-rose-500 dark:text-rose-400" },
  slate: { dot: "bg-slate-400 dark:bg-slate-600", glow: "", text: "text-slate-400 dark:text-slate-500" },
};

const LIVE = new Set(["active", "connected", "optimal", "interpreting"]);

export const StatusIndicator = ({ name, state, testId }) => {
  const [label, toneKey] = MAP[state] || MAP.idle;
  const t = TONE[toneKey];
  const animate = LIVE.has(state);
  return (
    <div
      data-testid={testId}
      data-state={state}
      title={`${name}: ${label}`}
      className="flex items-center gap-2 rounded-full h-9 pl-2.5 pr-3 bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10"
    >
      <span className="relative flex h-2.5 w-2.5">
        {animate && <span className={`absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping ${t.dot}`} />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${t.dot} ${t.glow}`} />
      </span>
      <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">{name}</span>
    </div>
  );
};
