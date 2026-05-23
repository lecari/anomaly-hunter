import { useState } from "react";

const SEVERITY_STYLES = {
  HIGH: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  LOW: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  NOTE: "bg-slate-700/30 text-slate-300 border-slate-600",
};

const SEVERITY_TOOLTIP = {
  HIGH: "HIGH severity: strong signal — large impact, multi-source confirmation, or a contradiction worth resolving.",
  MEDIUM: "MEDIUM severity: noteworthy pattern at moderate scale; worth a closer look soon.",
  LOW: "LOW severity: small effect or modestly confident; track but not urgent.",
  NOTE: "NOTE: marginal or low-confidence observation — recorded for awareness only.",
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
const SIGNIFICANCE_TOOLTIP = {
  investigate: "Investigate: clear, robust pattern (confidence ≥ 70%). Worth a deep follow-up.",
  monitor: "Monitor: moderate pattern (confidence 40–69%). Worth tracking over time.",
  noted: "Noted only: weak/marginal pattern (confidence < 40%). Documented for awareness; no action implied.",
};

const AGENT_ICON = {
  temporal: "🕒",
  distributional: "📊",
  relational: "🔗",
};

function discoveryBadge(framing) {
  if (framing === "unexpected") {
    return {
      text: "Unexpected discovery",
      cls: "text-amber-200 border-amber-500/40 bg-amber-500/15 font-medium",
      emoji: "💡",
      tooltip:
        "Unexpected discovery: a pattern the system found that did not match your stated focus. These often carry the highest value because you couldn't have anticipated them.",
    };
  }
  if (framing === "aligned") {
    return {
      text: "Aligned with your focus",
      cls: "text-slate-300 border-slate-600 bg-slate-700/30",
      emoji: "",
      tooltip: "Aligned with your focus: this finding directly addresses the objective you stated in optional context.",
    };
  }
  return null;
}

function convergenceLabel(convergenceType) {
  if (convergenceType === "convergent") {
    return {
      text: "Convergent — multiple specialists",
      cls: "text-indigo-300 border-indigo-500/30 bg-indigo-500/10",
      tooltip: "Two or more specialists independently flagged related patterns. Strongest signal.",
    };
  }
  if (convergenceType === "contradiction") {
    return {
      text: "Contradiction across specialists",
      cls: "text-rose-300 border-rose-500/30 bg-rose-500/10",
      tooltip: "Specialists disagreed — itself often a meaningful finding worth reading carefully.",
    };
  }
  return {
    text: "Isolated finding",
    cls: "text-slate-400 border-slate-700 bg-slate-800/40",
    tooltip: "Detected by one specialist only.",
  };
}

function Section({ label, children, tone = "default" }) {
  const labelCls =
    tone === "action"
      ? "text-indigo-300"
      : tone === "impact"
      ? "text-amber-300"
      : "text-slate-400";
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wider font-semibold ${labelCls} mb-1.5`}>
        {label}
      </div>
      <div className="text-sm text-slate-100 leading-relaxed">{children}</div>
    </div>
  );
}

export default function AnomalyCard({ ranked, narrative }) {
  const sev = SEVERITY_STYLES[ranked.severity] || SEVERITY_STYLES.NOTE;
  const sevTip = SEVERITY_TOOLTIP[ranked.severity] || SEVERITY_TOOLTIP.NOTE;
  const badge = discoveryBadge(narrative?.discoveryFraming || ranked.discoveryType);
  const conv = convergenceLabel(ranked.convergenceType);
  const sources = Array.isArray(ranked.sourceAgents) ? ranked.sourceAgents : [];
  const sigKey =
    ranked.significance && SIGNIFICANCE_LABEL[ranked.significance] ? ranked.significance : null;
  const confPct =
    typeof ranked.confidence === "number" ? Math.round(ranked.confidence * 100) : null;

  const [evidenceOpen, setEvidenceOpen] = useState(false);

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
      <header className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${sev}`}
            title={sevTip}
          >
            {ranked.severity}
          </span>
          {sigKey && (
            <span
              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${SIGNIFICANCE_STYLES[sigKey]}`}
              title={SIGNIFICANCE_TOOLTIP[sigKey]}
            >
              {SIGNIFICANCE_LABEL[sigKey]}
            </span>
          )}
          {confPct !== null && (
            <span
              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-slate-300"
              title={`The specialist's confidence in this pattern: ${confPct}% (0–100). Higher means more reliable signal.`}
            >
              Confidence {confPct}%
            </span>
          )}
          {badge && (
            <span
              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${badge.cls}`}
              title={badge.tooltip}
            >
              {badge.emoji && (
                <span className="mr-1" aria-hidden="true">
                  {badge.emoji}
                </span>
              )}
              {badge.text}
            </span>
          )}
          {ranked.rank != null && (
            <span className="text-xs text-slate-500" title="Position in the synthesis ranking (1 = top)">
              #{ranked.rank}
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-white leading-snug">
          {ranked.title || <span className="text-slate-500 italic">Untitled finding</span>}
        </h3>
      </header>

      {(narrative?.what || ranked.evidence) && (
        <Section label="What was detected">
          {narrative?.what && <p>{narrative.what}</p>}
          {ranked.evidence && (
            <div className="mt-3">
              <button
                type="button"
                aria-expanded={evidenceOpen}
                onClick={() => setEvidenceOpen((v) => !v)}
                className="text-[11px] uppercase tracking-wider text-slate-400 hover:text-slate-200 px-2 py-1 rounded border border-slate-700 bg-slate-800/40"
              >
                {evidenceOpen ? "Hide raw evidence" : "Show raw evidence"}
              </button>
              {evidenceOpen && (
                <pre className="mt-2 text-xs font-mono text-slate-300 bg-slate-950/60 border border-slate-800 rounded-md p-3 whitespace-pre-wrap leading-relaxed">
                  {ranked.evidence}
                </pre>
              )}
            </div>
          )}
        </Section>
      )}

      {narrative?.whyItMatters && (
        <Section label="Why this matters">
          <p>{narrative.whyItMatters}</p>
        </Section>
      )}

      {ranked.impactDescription && (
        <Section label="Impact for you" tone="impact">
          <p>{ranked.impactDescription}</p>
        </Section>
      )}

      {narrative?.whatToDo && (
        <Section label="Recommended action" tone="action">
          <p>{narrative.whatToDo}</p>
        </Section>
      )}

      <footer className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>Detected via</span>
        {sources.map((agent) => (
          <span
            key={agent}
            className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-slate-200"
            title={`${agent} specialist — see "How to read these findings" above for the toolkit of each specialist.`}
          >
            <span aria-hidden="true">{AGENT_ICON[agent] || "•"}</span> {agent}
          </span>
        ))}
        <span
          className={`sm:ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${conv.cls}`}
          title={conv.tooltip}
        >
          {conv.text}
        </span>
      </footer>
    </article>
  );
}
