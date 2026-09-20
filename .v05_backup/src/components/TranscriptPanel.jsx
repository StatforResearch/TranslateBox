import React, { useEffect, useRef } from "react";

export const TranscriptPanel = ({ label, badge, accent, text, active, panelTestId, textTestId }) => {
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  const isEmerald = accent === "emerald";
  const accentLine = isEmerald
    ? "from-emerald-400/80 via-emerald-400/20 to-transparent"
    : "from-cyan-400/80 via-cyan-400/20 to-transparent";
  const badgeClass = isEmerald
    ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
    : "text-cyan-600 dark:text-cyan-400 border-cyan-500/40 bg-cyan-500/10";
  const glowBlob = isEmerald ? "bg-emerald-500/10" : "bg-cyan-500/10";

  return (
    <div
      data-testid={panelTestId}
      className="relative flex flex-col rounded-2xl bg-white/80 dark:bg-[#121824]/70 backdrop-blur-xl border border-slate-200/70 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-black/30 overflow-hidden"
    >
      {/* top accent line */}
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentLine}`} />
      {/* ambient glow */}
      <div className={`pointer-events-none absolute -bottom-16 ${isEmerald ? "-right-16" : "-left-16"} h-48 w-48 rounded-full blur-3xl ${glowBlob}`} />

      <div className="relative flex items-center justify-between px-5 py-3.5 border-b border-slate-200/70 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center justify-center min-w-9 h-6 px-2 rounded-md border text-xs font-bold font-mono ${badgeClass}`}>{badge}</span>
          <h2 className="text-xs md:text-sm font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-300">{label}</h2>
        </div>
        {active && (
          <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.5)] animate-pulse" /> rec
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        data-testid={textTestId}
        className={`relative flex-1 overflow-y-auto px-5 md:px-7 py-5 min-h-[240px] max-h-[48vh] whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-50 font-sans ${isEmerald ? "text-lg md:text-xl lg:text-2xl font-medium" : "text-base md:text-lg lg:text-xl"}`}
      >
        {text ? (
          <>
            {text}
            {active && <span className="inline-block w-2 h-5 -mb-0.5 ml-0.5 bg-current opacity-40 animate-pulse rounded-[1px]" />}
          </>
        ) : (
          <span className="text-slate-400 dark:text-slate-600 italic text-base">
            {active ? "Listening…" : "Transcript will appear here once translation starts."}
          </span>
        )}
      </div>
    </div>
  );
};
