export default function OutputPreview() {
  return (
    <section className="mt-10">
      <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-4">What you'll get</h2>
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">Dataset profile</div>
          <div className="mt-1 text-sm text-slate-200">
            Inferred domain · value unit · time period · rows × cols · data quality score with dimension breakdown
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">Executive summary</div>
          <div className="mt-1 text-sm text-slate-200">
            BLUF-style summary covering both what was found related to your focus area, and what was discovered that you did not ask about.
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Every finding, classified by significance
          </div>
          {[
            { sev: "HIGH", sigLabel: "Investigate", sevClass: "bg-rose-500/15 text-rose-300 border-rose-500/30", sigClass: "text-rose-200 border-rose-500/30 bg-rose-500/10", framing: "Unexpected discovery", framingClass: "bg-amber-500/15 text-amber-300 border-amber-500/30", emoji: "💡" },
            { sev: "MEDIUM", sigLabel: "Investigate", sevClass: "bg-amber-500/15 text-amber-300 border-amber-500/30", sigClass: "text-rose-200 border-rose-500/30 bg-rose-500/10", framing: "Aligned with your focus", framingClass: "bg-slate-700/40 text-slate-300 border-slate-600", emoji: "" },
            { sev: "LOW", sigLabel: "Monitor", sevClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", sigClass: "text-amber-200 border-amber-500/30 bg-amber-500/10", framing: "Aligned with your focus", framingClass: "bg-slate-700/40 text-slate-300 border-slate-600", emoji: "" },
            { sev: "NOTE", sigLabel: "Noted only", sevClass: "bg-slate-700/30 text-slate-300 border-slate-600", sigClass: "text-slate-400 border-slate-700 bg-slate-800/60", framing: "Aligned with your focus", framingClass: "bg-slate-700/40 text-slate-300 border-slate-600", emoji: "" },
          ].map((row, i) => (
            <div key={i} className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${row.sevClass}`}>
                  {row.sev}
                </span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${row.sigClass}`}>
                  {row.sigLabel}
                </span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${row.framingClass}`}>
                  {row.emoji && <span aria-hidden="true" className="mr-1">{row.emoji}</span>}
                  {row.framing}
                </span>
                <span className="text-sm text-slate-200 ml-1">Anomaly title goes here</span>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Evidence (monospace) · why it matters · what to do · methodologies · confidence · source agents
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-500 leading-relaxed pt-1">
            Specialists report every finding — strong, moderate, and marginal — with explicit
            confidence and significance. You decide what to pursue.
          </p>
        </div>
      </div>
    </section>
  );
}
