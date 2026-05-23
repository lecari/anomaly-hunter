function hintLabel(matchValue) {
  switch (matchValue) {
    case "matches":
      return { text: "Matches your hint", cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" };
    case "partial":
      return { text: "Partial match", cls: "text-amber-300 border-amber-500/30 bg-amber-500/10" };
    case "contradicts":
      return { text: "Contradicts your hint", cls: "text-rose-300 border-rose-500/30 bg-rose-500/10" };
    default:
      return { text: "No hint provided", cls: "text-slate-300 border-slate-600 bg-slate-700/30" };
  }
}

function deriveTimePeriod(profile) {
  const temporal = profile?.columns?.find((c) => c.inferredRole === "temporal");
  const ts = temporal?.temporalStats;
  if (!ts) return null;
  const start = ts.start || ts.minDate || ts.min || ts.first || null;
  const end = ts.end || ts.maxDate || ts.max || ts.last || null;
  if (start && end) return `${start} → ${end}`;
  return null;
}

// Plain-language definitions for each ISO/IEC 25012 dimension we track.
const DIMENSION_INFO = {
  completeness: {
    label: "Completeness",
    blurb: "Share of cells that are filled in rather than blank/missing.",
  },
  consistency: {
    label: "Consistency",
    blurb: "How uniformly the same concept is represented across rows (formats, units, spellings).",
  },
  validity: {
    label: "Validity",
    blurb: "How well values respect the expected type and range (dates parse, numbers are numeric, categories known).",
  },
  uniqueness: {
    label: "Uniqueness",
    blurb: "Absence of unintended duplicates (e.g., the same record entered twice).",
  },
};

// Map a 0-100 score to a plain interpretation so the user knows whether a
// percentage is "good enough" without having to guess a threshold.
function interpretScore(pct) {
  if (pct == null) return { label: "—", cls: "text-slate-400 border-slate-700 bg-slate-800/60", bar: "bg-slate-600" };
  if (pct >= 90)
    return { label: "Excellent", cls: "text-emerald-200 border-emerald-500/30 bg-emerald-500/10", bar: "bg-emerald-400" };
  if (pct >= 75)
    return { label: "Good", cls: "text-emerald-200/80 border-emerald-500/20 bg-emerald-500/5", bar: "bg-emerald-300" };
  if (pct >= 60)
    return { label: "Acceptable", cls: "text-amber-200 border-amber-500/30 bg-amber-500/10", bar: "bg-amber-300" };
  return { label: "Needs attention", cls: "text-rose-200 border-rose-500/30 bg-rose-500/10", bar: "bg-rose-400" };
}

export default function DatasetProfileCard({ profile, orchestratorOutput }) {
  if (!profile) return null;
  const overview = profile.dataOverview || {};
  const dims = overview.dataQualityDimensions || {};
  const hint = hintLabel(overview.userDomainHintMatch);
  const timePeriod = deriveTimePeriod(profile);
  const valueUnit = orchestratorOutput?.valueUnit || overview.primaryValueUnit;
  const domainConfPct =
    typeof overview.domainConfidence === "number"
      ? Math.round(overview.domainConfidence * 100)
      : null;
  const overallPct =
    typeof overview.dataQualityScore === "number"
      ? Math.round(overview.dataQualityScore * 100)
      : null;
  const overallInterp = interpretScore(overallPct);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">Dataset profile</div>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <span className="text-xl font-semibold text-white">
              {orchestratorOutput?.confirmedDomain || overview.inferredDomain || "Dataset"}
            </span>
            {domainConfPct !== null && (
              <span
                className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-slate-300"
                title="How confident the Inspector is in the inferred domain, based on column names, value patterns, and any hint you provided."
              >
                {domainConfPct}% confidence
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-slate-400">
            {overview.totalRows ?? "?"} rows · {overview.totalColumns ?? "?"} columns
            {valueUnit ? <span> · values in {valueUnit}</span> : null}
            {timePeriod ? <span> · {timePeriod}</span> : null}
          </div>
        </div>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${hint.cls}`}>
          {hint.text}
        </span>
      </div>

      {Object.keys(dims).length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Data quality</div>
              <p className="text-xs text-slate-400 leading-snug mt-1 max-w-xl">
                Four ISO/IEC 25012 dimensions. Higher percentages mean the data is more reliable
                for downstream analysis. Anything below 60% on a dimension usually warrants a
                cleanup pass before drawing conclusions.
              </p>
            </div>
            {overallPct !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-slate-500">Overall</span>
                <span className="text-lg font-semibold text-white">{overallPct}%</span>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${overallInterp.cls}`}
                >
                  {overallInterp.label}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {["completeness", "consistency", "validity", "uniqueness"].map((k) => {
              const v = dims[k];
              const pct = typeof v === "number" ? Math.round(v * 100) : null;
              const interp = interpretScore(pct);
              const info = DIMENSION_INFO[k];
              return (
                <div
                  key={k}
                  className="rounded-md border border-slate-700 bg-slate-800/40 p-3"
                  title={info.blurb}
                >
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    {info.label}
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="text-lg font-semibold text-white">
                      {pct === null ? "—" : `${pct}%`}
                    </span>
                    <span
                      className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${interp.cls}`}
                    >
                      {interp.label}
                    </span>
                  </div>
                  {pct !== null && (
                    <div className="mt-2 h-1.5 bg-slate-700/60 rounded overflow-hidden" aria-hidden="true">
                      <div
                        className={`h-full ${interp.bar}`}
                        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                      />
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-slate-400 leading-snug">{info.blurb}</p>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] text-slate-500 leading-snug">
            <span className="font-semibold text-slate-400">How to read:</span> ≥90% Excellent · 75–89% Good · 60–74% Acceptable · &lt;60% Needs attention.
          </p>
        </div>
      )}
    </div>
  );
}
