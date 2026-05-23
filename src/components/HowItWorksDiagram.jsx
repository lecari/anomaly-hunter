const STAGES = [
  {
    name: "Inspector",
    desc: "Profiles every column (Tukey EDA, DAMA, ISO/IEC 25012)",
    parallel: false,
  },
  {
    name: "Orchestrator",
    desc: "Designs the analytical strategy (CRISP-DM)",
    parallel: false,
  },
  {
    name: "Specialists ×3",
    desc: "Temporal • Distributional • Relational — run in parallel",
    parallel: true,
  },
  {
    name: "Synthesis",
    desc: "Triangulation + Bayesian belief updating",
    parallel: false,
  },
  {
    name: "Narrative",
    desc: "Minto Pyramid, SCQA, BLUF for the chosen audience",
    parallel: false,
  },
];

export default function HowItWorksDiagram() {
  return (
    <section className="mt-12">
      <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-4">How it works</h2>
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch gap-3">
          {STAGES.map((s, i) => (
            <div key={s.name} className="flex flex-col sm:flex-row items-stretch">
              <div
                className={`flex-1 sm:min-w-[180px] rounded-lg px-4 py-3 border ${
                  s.parallel
                    ? "border-indigo-500/40 bg-indigo-500/5"
                    : "border-slate-700 bg-slate-800/40"
                }`}
              >
                <div className="text-sm font-semibold text-white">{s.name}</div>
                <div className="mt-1 text-xs text-slate-400 leading-snug">{s.desc}</div>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  aria-hidden="true"
                  className="self-center mx-2 my-1 sm:my-0 text-slate-500 select-none"
                >
                  <span className="hidden sm:inline">→</span>
                  <span className="sm:hidden">↓</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
