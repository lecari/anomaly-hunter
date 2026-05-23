const TIERS = [
  { key: "investigate", label: "investigate", cls: "text-rose-200 border-rose-500/30 bg-rose-500/10" },
  { key: "monitor", label: "monitor", cls: "text-amber-200 border-amber-500/30 bg-amber-500/10" },
  { key: "noted", label: "noted", cls: "text-slate-300 border-slate-700 bg-slate-800/60" },
];

export default function ExecutiveSummary({
  text,
  keyTakeaways,
  unexpectedCount,
  significanceCounts,
  totalFindings,
}) {
  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasTakeaways = Array.isArray(keyTakeaways) && keyTakeaways.length > 0;
  if (!hasText && !hasTakeaways && !totalFindings) return null;

  const counts = significanceCounts || {};
  const hasTiers = TIERS.some((t) => typeof counts[t.key] === "number" && counts[t.key] > 0);

  return (
    <section
      aria-labelledby="exec-summary-heading"
      className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5 space-y-4"
    >
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <h3
          id="exec-summary-heading"
          className="text-xs uppercase tracking-wider text-indigo-300"
        >
          Executive summary
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {typeof unexpectedCount === "number" && unexpectedCount > 0 && (
            <span
              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/15 text-amber-300"
              title="Patterns the system detected that did not match your stated focus area."
            >
              <span aria-hidden="true">💡 </span>
              {unexpectedCount} unexpected
            </span>
          )}
          {typeof totalFindings === "number" && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-slate-600 bg-slate-800/60 text-slate-300">
              {totalFindings} total finding{totalFindings === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </header>

      {hasTiers && (
        <div
          className="flex flex-wrap items-center gap-2"
          title="How the findings break down by recommended next-step level."
        >
          <span className="text-[10px] uppercase tracking-wider text-slate-500">By significance</span>
          {TIERS.map((t) => {
            const n = counts[t.key];
            if (typeof n !== "number" || n <= 0) return null;
            return (
              <span
                key={t.key}
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${t.cls}`}
              >
                {n} {t.label}
              </span>
            );
          })}
        </div>
      )}

      {hasText && (
        <p className="text-slate-100 leading-relaxed whitespace-pre-line">{text}</p>
      )}

      {hasTakeaways && (
        <div className="pt-2">
          <div className="text-xs uppercase tracking-wider text-indigo-300 mb-2">
            Key takeaways at a glance
          </div>
          <ul className="space-y-3 list-none m-0 p-0">
            {keyTakeaways.map((t, i) => (
              <li
                key={t.id || i}
                className="rounded-md border border-indigo-500/20 bg-slate-900/40 p-3"
              >
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">
                    #{i + 1}
                  </span>
                  <span className="text-sm text-slate-100 font-medium leading-snug">
                    {t.finding || <span className="text-slate-500 italic">No headline emitted</span>}
                  </span>
                </div>
                <div className="grid sm:grid-cols-3 gap-2 text-xs">
                  {t.relevance && (
                    <div>
                      <div className="uppercase tracking-wider text-slate-500 text-[10px]">
                        Why it matters
                      </div>
                      <div className="text-slate-200 leading-snug mt-0.5">{t.relevance}</div>
                    </div>
                  )}
                  {t.impact && (
                    <div>
                      <div className="uppercase tracking-wider text-slate-500 text-[10px]">
                        Impact for you
                      </div>
                      <div className="text-slate-200 leading-snug mt-0.5">{t.impact}</div>
                    </div>
                  )}
                  {t.action && (
                    <div>
                      <div className="uppercase tracking-wider text-slate-500 text-[10px]">
                        Suggested action
                      </div>
                      <div className="text-slate-200 leading-snug mt-0.5">{t.action}</div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
