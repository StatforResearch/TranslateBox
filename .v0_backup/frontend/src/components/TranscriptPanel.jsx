import React, { useEffect, useRef } from "react";

export const TranscriptPanel = ({ label, badge, accent, text, active, panelTestId, textTestId }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  const accentClasses =
    accent === "emerald"
      ? "text-emerald-500 dark:text-emerald-400 border-emerald-500/30"
      : "text-cyan-600 dark:text-cyan-400 border-cyan-500/30";

  return (
    <div
      className="flex flex-col rounded-2xl bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden"
      data-testid={panelTestId}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F1623]">
        <div className="flex items-center gap-2.5">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md border font-mono ${accentClasses}`}>
            {badge}
          </span>
          <h2 className="text-sm md:text-base font-bold tracking-wide uppercase text-slate-700 dark:text-slate-200">
            {label}
          </h2>
        </div>
        {active && (
          <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            live
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        data-testid={textTestId}
        className="flex-1 overflow-y-auto px-5 md:px-7 py-5 min-h-[220px] max-h-[46vh] whitespace-pre-wrap text-base md:text-lg lg:text-xl leading-relaxed text-slate-800 dark:text-slate-100 font-sans"
      >
        {text ? (
          text
        ) : (
          <span className="text-slate-400 dark:text-slate-600 italic text-base">
            {active ? "Listening…" : "Transcript will appear here once translation starts."}
          </span>
        )}
      </div>
    </div>
  );
};
