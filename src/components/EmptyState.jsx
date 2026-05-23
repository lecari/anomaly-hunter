export default function EmptyState({ headingRef, onReset }) {
  return (
    <div className="max-w-2xl mx-auto pt-16 pb-16 px-4 text-center">
      <div className="text-5xl mb-4" aria-hidden="true">🪶</div>
      <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-white focus:outline-none">
        No findings to report
      </h2>
      <p className="mt-3 text-slate-400 leading-relaxed">
        The specialist agents completed their scans and the synthesizer returned an empty
        result set. Specialists are instructed to always emit at least a few "noted"
        findings even on unremarkable data, so this state is unusual — it usually means the
        dataset is extremely small or the agents could not interpret it. Try a larger CSV
        or check the data quality.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-8 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
      >
        Analyze another dataset
      </button>
    </div>
  );
}
