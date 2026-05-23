import { useState } from "react";

const SEVERITY_ROWS = [
  {
    label: "HIGH",
    cls: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    desc: "Strong signal — large impact, multi-source confirmation, or a contradiction worth resolving.",
  },
  {
    label: "MEDIUM",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    desc: "Noteworthy pattern at moderate scale; worth a closer look soon.",
  },
  {
    label: "LOW",
    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    desc: "Small effect or only modestly confident; track but not urgent.",
  },
  {
    label: "NOTE",
    cls: "bg-slate-700/30 text-slate-300 border-slate-600",
    desc: "Marginal or low-confidence observation — recorded for awareness, no action implied.",
  },
];

const SIGNIFICANCE_ROWS = [
  {
    label: "Investigate",
    cls: "text-rose-200 border-rose-500/30 bg-rose-500/10",
    desc: "Clear, robust pattern (confidence ≥ 70%). The specialist recommends a deeper look.",
  },
  {
    label: "Monitor",
    cls: "text-amber-200 border-amber-500/30 bg-amber-500/10",
    desc: "Moderate pattern (confidence 40–69%). Worth tracking over time.",
  },
  {
    label: "Noted only",
    cls: "text-slate-400 border-slate-700 bg-slate-800/60",
    desc: "Weak/marginal signal (confidence < 40%). Documented so you know what was scanned.",
  },
];

const DISCOVERY_ROWS = [
  {
    label: "Aligned with your focus",
    cls: "text-slate-300 border-slate-600 bg-slate-700/30",
    emoji: null,
    desc: "Matches the objective you stated in optional context (or general exploration if none).",
  },
  {
    label: "Unexpected discovery",
    cls: "text-amber-200 border-amber-500/40 bg-amber-500/15 font-medium",
    emoji: "💡",
    desc: "Pattern the system found that you did not specifically ask about. These often carry the highest value because they're things you couldn't have anticipated.",
  },
];

const CONVERGENCE_ROWS = [
  { label: "Isolated finding", desc: "Detected by one specialist only." },
  { label: "Convergent — multiple specialists", desc: "Two or more specialists independently flagged related patterns. Strongest signal." },
  { label: "Contradiction across specialists", desc: "Specialists disagreed — itself often a meaningful finding worth reading carefully." },
];

export default function FindingsLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="findings-legend-body"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span className="text-sm font-medium text-slate-200">How to read these findings</span>
        <span className="text-xs text-slate-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div id="findings-legend-body" className="px-5 pb-5 border-t border-slate-800 space-y-5 pt-4">
          <Section title="Severity (left badge)">
            {SEVERITY_ROWS.map((r) => (
              <Row
                key={r.label}
                badge={<span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${r.cls}`}>{r.label}</span>}
                desc={r.desc}
              />
            ))}
          </Section>

          <Section title="Significance — what the specialist recommends">
            {SIGNIFICANCE_ROWS.map((r) => (
              <Row
                key={r.label}
                badge={<span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${r.cls}`}>{r.label}</span>}
                desc={r.desc}
              />
            ))}
          </Section>

          <Section title="Confidence %">
            <p className="text-xs text-slate-400 leading-snug">
              How sure the specialist is about the pattern, on a 0–100% scale. The specialist
              reports everything — both confident findings and marginal ones — so you can decide.
              Significance follows confidence: ≥70% → Investigate, 40–69% → Monitor, &lt;40% → Noted.
            </p>
          </Section>

          <Section title="Discovery framing">
            {DISCOVERY_ROWS.map((r) => (
              <Row
                key={r.label}
                badge={
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${r.cls}`}>
                    {r.emoji && <span aria-hidden="true" className="mr-1">{r.emoji}</span>}
                    {r.label}
                  </span>
                }
                desc={r.desc}
              />
            ))}
          </Section>

          <Section title="Detected via / convergence">
            {CONVERGENCE_ROWS.map((r) => (
              <Row
                key={r.label}
                badge={<span className="text-[10px] uppercase tracking-wider text-slate-300 px-2 py-0.5 rounded border border-slate-700 bg-slate-800/60">{r.label}</span>}
                desc={r.desc}
              />
            ))}
            <p className="text-xs text-slate-500 leading-snug pt-1">
              Specialist icons: <span aria-hidden="true">🕒</span> temporal (time-series), <span aria-hidden="true">📊</span> distributional (drift / concentration), <span aria-hidden="true">🔗</span> relational (multivariate).
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ badge, desc }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 mt-0.5">{badge}</div>
      <div className="text-xs text-slate-300 leading-snug">{desc}</div>
    </div>
  );
}
