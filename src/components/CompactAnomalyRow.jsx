const SEVERITY_STYLES = {
  HIGH: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  LOW: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  NOTE: "bg-slate-700/30 text-slate-300 border-slate-600",
};

const SIGNIFICANCE_LABEL = {
  investigate: "Investigate",
  monitor: "Monitor",
  noted: "Noted only",
};

const SIGNIFICANCE_STYLES = {
  investigate: "text-rose-200 border-rose-500/30 bg-rose-500/10",
  monitor: "text-amber-200 border-amber-500/30 bg-amber-500/10",
  noted: "text-slate-400 border-slate-700 bg-slate-800/60",
};

const AGENT_ICON = {
  temporal: "🕒",
  distributional: "📊",
  relational: "🔗",
};

// Used for anomalies BELOW the top 5 — they have synthesis data but no narrative.
// Renders inline as a single-line summary row that can be expanded for the evidence.
export default function CompactAnomalyRow({ ranked }) {
  const sev = SEVERITY_STYLES[ranked.severity] || SEVERITY_STYLES.NOTE;
  const sigKey =
    ranked.significance && SIGNIFICANCE_LABEL[ranked.significance] ? ranked.significance : null;
  const confPct =
    typeof ranked.confidence === "number" ? Math.round(ranked.confidence * 100) : null;
  const sources = Array.isArray(ranked.sourceAgents) ? ranked.sourceAgents : [];

  return (
    <details className="rounded-md border border-slate-800 bg-slate-900/30 group">
      <summary className="flex items-center gap-2 flex-wrap px-3 py-2 cursor-pointer list-none">
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${sev}`}>
          {ranked.severity}
        </span>
        {sigKey && (
          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${SIGNIFICANCE_STYLES[sigKey]}`}>
            {SIGNIFICANCE_LABEL[sigKey]}
          </span>
        )}
        {confPct !== null && (
          <span className="text-[10px] text-slate-500">{confPct}%</span>
        )}
        {ranked.rank != null && (
          <span className="text-xs text-slate-500">#{ranked.rank}</span>
        )}
        <span className="text-sm text-slate-200 flex-1 min-w-0 truncate">
          {ranked.title || <span className="text-slate-500 italic">Untitled finding</span>}
        </span>
        <span className="text-xs text-slate-500 hidden sm:inline" aria-hidden="true">
          {sources.map((a) => AGENT_ICON[a] || "•").join(" ")}
        </span>
        <span aria-hidden="true" className="text-xs text-slate-500 group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-3 pb-3 pt-1 border-t border-slate-800 space-y-2">
        {ranked.evidence && (
          <pre className="text-xs font-mono text-slate-300 bg-slate-950/60 border border-slate-800 rounded p-2 whitespace-pre-wrap leading-relaxed">
            {ranked.evidence}
          </pre>
        )}
        {ranked.impactDescription && (
          <div className="text-xs text-slate-400">
            <span className="uppercase tracking-wider text-slate-500 mr-1">Impact:</span>
            {ranked.impactDescription}
          </div>
        )}
        <div className="text-xs text-slate-500">
          Detected via{" "}
          {sources.length === 0
            ? "—"
            : sources.map((a, i) => (
                <span key={a} className="text-slate-300">
                  {i > 0 ? ", " : ""}
                  <span aria-hidden="true">{AGENT_ICON[a] || "•"}</span> {a}
                </span>
              ))}
        </div>
      </div>
    </details>
  );
}
