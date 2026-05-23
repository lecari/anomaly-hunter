import DatasetProfileCard from "./DatasetProfileCard";
import ExecutiveSummary from "./ExecutiveSummary";
import AnomalyCard from "./AnomalyCard";
import CompactAnomalyRow from "./CompactAnomalyRow";
import FindingsLegend from "./FindingsLegend";

export default function Results({
  headingRef,
  profile,
  orchestratorOutput,
  synthesis,
  narrative,
  onReset,
}) {
  const narrativeAnomalies = narrative?.anomalies || [];
  const narrativeById = {};
  for (const n of narrativeAnomalies) {
    if (n?.id) narrativeById[n.id] = n;
  }

  const ranked = synthesis?.rankedAnomalies || [];
  const topFive = ranked.slice(0, 5);
  const rest = ranked.slice(5);

  // Defensive: if the narrative model deviates from the synthesis ids, we still
  // pair by position (top-5 are emitted in rank order on both sides).
  function narrativeFor(rankedAnom, idx) {
    return narrativeById[rankedAnom.id] || narrativeAnomalies[idx] || null;
  }

  return (
    <div className="max-w-5xl mx-auto pt-10 pb-16 px-4 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold text-white focus:outline-none"
        >
          Findings
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Analyze another dataset
        </button>
      </div>

      <DatasetProfileCard profile={profile} orchestratorOutput={orchestratorOutput} />

      <ExecutiveSummary
        text={narrative?.executiveSummary}
        keyTakeaways={narrative?.keyTakeaways}
        unexpectedCount={synthesis?.unexpectedDiscoveryCount}
        significanceCounts={synthesis?.significanceCounts}
        totalFindings={ranked.length}
      />

      <section aria-labelledby="detailed-findings-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3 id="detailed-findings-heading" className="text-lg font-semibold text-white">
            Detailed findings
          </h3>
          <span className="text-xs text-slate-500">
            {topFive.length} card{topFive.length === 1 ? "" : "s"}
            {rest.length > 0 ? ` + ${rest.length} more below` : ""}
          </span>
        </div>

        <FindingsLegend />

        <div className="space-y-4">
          {topFive.map((r, i) => (
            <AnomalyCard key={r.id || r.rank} ranked={r} narrative={narrativeFor(r, i)} />
          ))}
        </div>
      </section>

      {rest.length > 0 && (
        <section aria-labelledby="also-detected-heading" className="space-y-2 pt-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="also-detected-heading" className="text-sm uppercase tracking-widest text-slate-400">
              Also detected — for awareness
            </h3>
            <span className="text-xs text-slate-500">
              {rest.length} additional finding{rest.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Lower-significance findings the specialists flagged. Expand any row to see the evidence
            and which agent detected it.
          </p>
          <div className="space-y-1.5">
            {rest.map((r) => (
              <CompactAnomalyRow key={r.id || r.rank} ranked={r} />
            ))}
          </div>
        </section>
      )}

      {synthesis?.synthesisNotes && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Synthesis notes</div>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {synthesis.synthesisNotes}
          </p>
        </div>
      )}
    </div>
  );
}
