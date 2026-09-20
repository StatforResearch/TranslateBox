import React from "react";

const STATE_STYLES = {
  active: { dot: "bg-emerald-400", ring: "bg-emerald-400", label: "ACTIVE" },
  connected: { dot: "bg-emerald-400", ring: "bg-emerald-400", label: "CONNECTED" },
  optimal: { dot: "bg-emerald-400", ring: "bg-emerald-400", label: "OPTIMAL" },
  interpreting: { dot: "bg-cyan-400", ring: "bg-cyan-400", label: "INTERPRETING" },
  connecting: { dot: "bg-amber-400", ring: "bg-amber-400", label: "CONNECTING" },
  degraded: { dot: "bg-amber-400", ring: "bg-amber-400", label: "DEGRADED" },
  muted: { dot: "bg-amber-400", ring: "bg-amber-400", label: "MUTED" },
  denied: { dot: "bg-red-500", ring: "bg-red-500", label: "DENIED" },
  error: { dot: "bg-red-500", ring: "bg-red-500", label: "ERROR" },
  offline: { dot: "bg-red-500", ring: "bg-red-500", label: "OFFLINE" },
  idle: { dot: "bg-slate-600", ring: "bg-slate-600", label: "IDLE" },
  standby: { dot: "bg-slate-600", ring: "bg-slate-600", label: "STANDBY" },
};

const LIVE = new Set(["active", "connected", "optimal", "interpreting", "connecting", "degraded"]);

export const StatusIndicator = ({ name, icon: Icon, state, testId }) => {
  const s = STATE_STYLES[state] || STATE_STYLES.idle;
  const animate = LIVE.has(state);
  return (
    <div
      className="flex items-center gap-3 rounded-lg bg-slate-900/60 dark:bg-slate-900/60 px-3 py-2 border border-slate-200/70 dark:border-slate-800"
      data-testid={testId}
      data-state={state}
    >
      <span className="relative flex h-3 w-3 shrink-0">
        {animate && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${s.ring}`} />
        )}
        <span className={`relative inline-flex h-3 w-3 rounded-full ${s.dot}`} />
      </span>
      {Icon && <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400 hidden sm:block" strokeWidth={2} />}
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">
          {name}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-mono">
          {s.label}
        </span>
      </div>
    </div>
  );
};
