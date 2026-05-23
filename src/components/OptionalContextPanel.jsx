import { useState } from "react";

const DOMAINS = [
  { value: "", label: "Auto-detect" },
  { value: "Personal Finance", label: "Personal Finance" },
  { value: "Business Finance", label: "Business Finance" },
  { value: "Sales / Revenue", label: "Sales / Revenue" },
  { value: "Marketing / Customer Analytics", label: "Marketing / Customer Analytics" },
  { value: "Operations / Supply Chain", label: "Operations / Supply Chain" },
  { value: "HR / People Analytics", label: "HR / People Analytics" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Scientific / Research", label: "Scientific / Research" },
  { value: "IoT / Sensor Data", label: "IoT / Sensor Data" },
  { value: "__other__", label: "Other" },
];

const OBJECTIVES = [
  { value: "", label: "General exploration" },
  { value: "Find waste or inefficiency", label: "Find waste or inefficiency" },
  { value: "Detect risk or unusual activity", label: "Detect risk or unusual activity" },
  { value: "Identify trends and shifts", label: "Identify trends and shifts" },
  { value: "Spot outliers and exceptions", label: "Spot outliers and exceptions" },
];

const AUDIENCES = [
  { value: "general", label: "General" },
  { value: "executive", label: "Executive (brief, BLUF)" },
  { value: "technical", label: "Technical (detailed, methods-focused)" },
];

export default function OptionalContextPanel({
  value,
  onChange,
  sequentialSpecialists,
  onSequentialChange,
}) {
  const [open, setOpen] = useState(false);

  // "Other" is a UI-only intent — we have to remember it locally because an
  // empty text input maps to the same null parent state as "Auto-detect".
  // Default it based on the initial value.
  const initialIsOther =
    !!value.domainHint && !DOMAINS.find((d) => d.value === value.domainHint);
  const [otherSelected, setOtherSelected] = useState(initialIsOther);

  const fixedDomain =
    value.domainHint && DOMAINS.find((d) => d.value === value.domainHint);
  const domainChoice = fixedDomain
    ? value.domainHint
    : otherSelected
    ? "__other__"
    : "";
  const otherDomain = otherSelected ? value.domainHint || "" : "";

  function update(patch) {
    onChange({ ...value, ...patch });
  }

  function handleDomain(choice) {
    if (choice === "") {
      setOtherSelected(false);
      update({ domainHint: null });
    } else if (choice === "__other__") {
      setOtherSelected(true);
      update({ domainHint: otherDomain || null });
    } else {
      setOtherSelected(false);
      update({ domainHint: choice });
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="optional-context-panel-body"
        aria-label={open ? "Hide optional agent guidance" : "Show optional agent guidance"}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-medium text-slate-200">Help the agents (optional)</span>
        <span className="text-slate-400 text-xs">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div id="optional-context-panel-body" className="px-5 pb-5 space-y-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 pt-4 leading-relaxed">
            These inputs help the agents focus — the system will always perform a comprehensive
            scan and surface unexpected findings regardless of what you specify.
          </p>

          <div>
            <label htmlFor="ctx-domain" className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Domain hint
            </label>
            <select
              id="ctx-domain"
              value={domainChoice}
              onChange={(e) => handleDomain(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              {DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            {domainChoice === "__other__" && (
              <input
                id="ctx-domain-other"
                type="text"
                aria-label="Describe the domain"
                value={otherDomain}
                onChange={(e) => update({ domainHint: e.target.value })}
                placeholder="Describe the domain"
                className="mt-2 w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            )}
          </div>

          <div>
            <label htmlFor="ctx-objective" className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              What you want to find
            </label>
            <select
              id="ctx-objective"
              value={value.analyticalObjective || ""}
              onChange={(e) => update({ analyticalObjective: e.target.value || null })}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              {OBJECTIVES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ctx-notes" className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Notes
            </label>
            <textarea
              id="ctx-notes"
              maxLength={500}
              rows={3}
              value={value.notes || ""}
              onChange={(e) => update({ notes: e.target.value || null })}
              placeholder="Anything the agents should know? Known events that explain unusual patterns, business context. Patterns you note here will still be detected, but their context will be considered."
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
            />
            <div className="mt-1 text-[10px] text-slate-500 text-right">
              {(value.notes || "").length}/500
            </div>
          </div>

          <div>
            <label htmlFor="ctx-audience" className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Report audience
            </label>
            <select
              id="ctx-audience"
              value={value.audience}
              onChange={(e) => update({ audience: e.target.value })}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {typeof onSequentialChange === "function" && (
            <div className="pt-2 border-t border-slate-800">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
                Execution mode
              </div>
              <label
                htmlFor="ctx-sequential"
                className="flex items-start gap-3 cursor-pointer"
              >
                <input
                  id="ctx-sequential"
                  type="checkbox"
                  checked={!!sequentialSpecialists}
                  onChange={(e) => onSequentialChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 accent-indigo-500"
                />
                <span className="text-sm text-slate-200 leading-snug">
                  Run specialists one at a time
                  <span className="block text-[11px] text-slate-500 mt-0.5 font-normal">
                    Slower wall-clock (≈3× the specialist phase), but avoids
                    parallel rate-limit pressure on the Anthropic API. Try this
                    if you saw &ldquo;Request timed out&rdquo; on multiple
                    specialists in a previous run.
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
