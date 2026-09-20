import React from "react";

// Horizontal audio level meter with peak marker. level & peak are 0..1.
export const LevelMeter = ({ level = 0, peak = 0, active = false }) => {
  const pct = Math.round(level * 100);
  const peakPct = Math.round(peak * 100);
  const barColor = level > 0.85 ? "bg-red-500" : level > 0.6 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="w-full" data-testid="audio-level-meter" data-level={pct}>
      <div className="relative h-4 w-full rounded-md bg-slate-200 dark:bg-[#0B0F17] border border-slate-300 dark:border-slate-700 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${barColor} transition-[width] duration-75`}
          style={{ width: `${pct}%` }}
        />
        {peakPct > 2 && (
          <div
            data-testid="audio-peak-indicator"
            className="absolute inset-y-0 w-0.5 bg-white/90 shadow"
            style={{ left: `calc(${peakPct}% - 1px)` }}
          />
        )}
        {/* segment ticks */}
        <div className="absolute inset-0 flex justify-between opacity-30 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <span key={i} className="w-px h-full bg-slate-400 dark:bg-slate-600" />
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
        <span>{active ? (pct > 2 ? "Signal detected" : "Silence…") : "Idle"}</span>
        <span>peak {peakPct}%</span>
      </div>
    </div>
  );
};
