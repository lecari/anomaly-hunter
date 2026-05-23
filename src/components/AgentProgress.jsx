import { useState } from "react";
import AgentProgressRow from "./AgentProgressRow";

const ROLES = {
  inspector: "Profiles every column — Tukey EDA, DAMA, ISO/IEC 25012",
  orchestrator: "Designs the analytical strategy — CRISP-DM",
  temporal: "Time-series analysis — STL, PELT, Mann-Kendall, Matrix Profile",
  distributional: "Distribution & drift — KS, PSI, JS, Wasserstein, Pareto, Gini, HHI",
  relational: "Multivariate — Pearson/Spearman/Kendall, MI, LOF, Mahalanobis, DBSCAN",
  synthesis: "Triangulation + Bayesian belief updating",
  narrative: "Business narrative — Minto Pyramid, SCQA, BLUF, SMART",
};

export default function AgentProgress({
  headingRef,
  statuses,
  methodologies,
  errors,
  onRetry,
  activatedSpecialists,
  sequentialSpecialists,
}) {
  const [expanded, setExpanded] = useState({});
  function toggle(key) {
    setExpanded((m) => ({ ...m, [key]: !m[key] }));
  }

  const specialists = ["temporal", "distributional", "relational"];

  return (
    <div className="max-w-2xl mx-auto pt-12 pb-12 px-4">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold text-white text-center focus:outline-none"
      >
        Analyzing your dataset…
      </h2>
      <p className="text-sm text-slate-400 text-center mt-1">
        Seven expert agents profiling, strategizing, hunting, synthesizing, and writing.
      </p>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Agent progress"
        className="mt-8 space-y-3"
      >
        <AgentProgressRow
          name="1. Inspector"
          role={ROLES.inspector}
          status={statuses.inspector}
          methodologies={methodologies.inspector}
          error={errors.inspector}
          onRetry={() => onRetry("inspector")}
          expanded={expanded.inspector}
          onToggleExpand={() => toggle("inspector")}
        />
        <AgentProgressRow
          name="2. Orchestrator"
          role={ROLES.orchestrator}
          status={statuses.orchestrator}
          methodologies={methodologies.orchestrator}
          error={errors.orchestrator}
          onRetry={() => onRetry("orchestrator")}
          expanded={expanded.orchestrator}
          onToggleExpand={() => toggle("orchestrator")}
        />

        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 px-4 py-3">
          <div className="text-xs uppercase tracking-wider text-indigo-300 mb-3">
            3–5. {sequentialSpecialists ? "Running one at a time" : "Running in parallel"}
          </div>
          <div className="space-y-3">
            {specialists.map((key, i) => {
              // Before the Orchestrator runs, activatedSpecialists is undefined — treat as
              // "unknown / possibly active" and just render the agent's current status.
              const isUnknown = activatedSpecialists == null;
              const isActive = isUnknown || activatedSpecialists.includes(key);
              const status = isActive ? statuses[key] : "skipped";
              return (
                <div key={key} className={isActive ? "" : "opacity-60"}>
                  <AgentProgressRow
                    name={`${i + 3}. ${key.charAt(0).toUpperCase() + key.slice(1)}${
                      isActive ? "" : " (not activated)"
                    }`}
                    role={ROLES[key]}
                    status={status}
                    methodologies={methodologies[key]}
                    error={errors[key]}
                    onRetry={isActive ? () => onRetry(key) : undefined}
                    expanded={expanded[key]}
                    onToggleExpand={() => toggle(key)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <AgentProgressRow
          name="6. Synthesis"
          role={ROLES.synthesis}
          status={statuses.synthesis}
          methodologies={methodologies.synthesis}
          error={errors.synthesis}
          onRetry={() => onRetry("synthesis")}
          expanded={expanded.synthesis}
          onToggleExpand={() => toggle("synthesis")}
        />
        <AgentProgressRow
          name="7. Narrative"
          role={ROLES.narrative}
          status={statuses.narrative}
          methodologies={methodologies.narrative}
          error={errors.narrative}
          onRetry={() => onRetry("narrative")}
          expanded={expanded.narrative}
          onToggleExpand={() => toggle("narrative")}
        />
      </div>
    </div>
  );
}
