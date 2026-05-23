function StatusIcon({ status }) {
  if (status === "waiting") {
    return <span className="text-slate-500 text-lg leading-none">⏳</span>;
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5">
        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 pulse-dot" />
      </span>
    );
  }
  if (status === "complete") {
    return <span className="text-emerald-400 text-lg leading-none">✓</span>;
  }
  if (status === "error") {
    return <span className="text-rose-400 text-lg leading-none">✕</span>;
  }
  if (status === "skipped") {
    return <span className="text-slate-600 text-lg leading-none">—</span>;
  }
  return null;
}

export default function AgentProgressRow({
  name,
  role,
  status,
  methodologies,
  error,
  onRetry,
  expanded,
  onToggleExpand,
}) {
  const canExpand = status === "complete" && methodologies && methodologies.length > 0;
  const statusLabel = {
    waiting: "waiting",
    running: "running",
    complete: "complete",
    error: "error",
    skipped: "not activated",
  }[status] || status;

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/40" aria-label={`${name}: ${statusLabel}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-6 flex justify-center" aria-hidden="true">
          <StatusIcon status={status} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-100">{name}</div>
          {role && <div className="text-xs text-slate-500">{role}</div>}
          {status === "error" && error && (
            <div className="mt-1 text-xs text-rose-400">{error}</div>
          )}
        </div>
        {status === "error" && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs rounded border border-rose-500/40 text-rose-300 px-3 py-1.5 hover:bg-rose-500/10"
          >
            Retry
          </button>
        )}
        {canExpand && (
          <button
            type="button"
            aria-expanded={!!expanded}
            onClick={onToggleExpand}
            className="text-xs px-2 py-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            {expanded ? "Hide methods" : "Methods"}
          </button>
        )}
      </div>
      {canExpand && expanded && (
        <div className="px-4 pb-3 border-t border-slate-800 pt-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Methodologies used
          </div>
          <div className="flex flex-wrap gap-1.5">
            {methodologies.map((m, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-slate-300"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
