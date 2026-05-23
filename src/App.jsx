import { useEffect, useRef, useState } from "react";
import HeroSection from "./components/HeroSection";
import HowItWorksDiagram from "./components/HowItWorksDiagram";
import OutputPreview from "./components/OutputPreview";
import ApiKeyInput from "./components/ApiKeyInput";
import FileUpload from "./components/FileUpload";
import SampleDataButton from "./components/SampleDataButton";
import OptionalContextPanel from "./components/OptionalContextPanel";
import AgentProgress from "./components/AgentProgress";
import Results from "./components/Results";
import EmptyState from "./components/EmptyState";

import { inspector } from "./agents/inspector";
import { orchestrator } from "./agents/orchestrator";
import { temporalAgent } from "./agents/temporalAgent";
import { distributionalAgent } from "./agents/distributionalAgent";
import { relationalAgent } from "./agents/relationalAgent";
import { synthesisAgent } from "./agents/synthesisAgent";
import { narrativeAgent } from "./agents/narrativeAgent";
import { isAbortError } from "./agents/utils";

const SCREEN_SETUP = "setup";
const SCREEN_PROCESSING = "processing";
const SCREEN_RESULTS = "results";
const SCREEN_EMPTY = "empty";

const DEFAULT_USER_CONTEXT = {
  domainHint: null,
  analyticalObjective: null,
  notes: null,
  audience: "general",
};

const emptyStatuses = () => ({
  inspector: "waiting",
  orchestrator: "waiting",
  temporal: "waiting",
  distributional: "waiting",
  relational: "waiting",
  synthesis: "waiting",
  narrative: "waiting",
});

function methodologiesFromInspector(p) {
  return p?.methodologiesApplied || [];
}
function methodologiesFromOrchestrator(o) {
  const all = new Set();
  for (const key of ["temporal", "distributional", "relational"]) {
    const inst = o?.agentInstructions?.[key];
    if (!inst) continue;
    (inst.prioritizedMethods || []).forEach((m) => all.add(m));
    (inst.broaderScanMethods || []).forEach((m) => all.add(m));
  }
  return Array.from(all);
}

function isAuthError(err) {
  if (err?.status === 401) return true;
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("401") || msg.includes("unauthor") || msg.includes("invalid api key");
}

function isRateLimitError(err) {
  if (err?.status === 429) return true;
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("429") || msg.includes("rate limit");
}

// Quick client-side CSV sanity check so we don't burn 7 API calls on garbage input.
function validateCsv(csvString) {
  if (typeof csvString !== "string" || csvString.trim().length === 0) {
    return "The file appears to be empty.";
  }
  // The BOM has already been stripped at ingest, but tolerate it here too.
  const clean = csvString.charCodeAt(0) === 0xfeff ? csvString.slice(1) : csvString;

  // Detect binary files masquerading as .csv: sample the first 1 KB and count
  // disallowed control characters (NUL, plus 1-8, 11, 14-31). Text CSVs should
  // have effectively none. PNG/PDF/ZIP signatures all trip this immediately.
  const probeLen = Math.min(clean.length, 1024);
  let bad = 0;
  for (let i = 0; i < probeLen; i++) {
    const c = clean.charCodeAt(i);
    if (c === 0 || (c >= 1 && c <= 8) || c === 11 || (c >= 14 && c <= 31)) bad++;
  }
  if (bad > 4 || (probeLen > 0 && bad / probeLen > 0.005)) {
    return "This file does not look like text. Drop a real CSV (UTF-8 / ASCII).";
  }

  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return "CSV must have a header row plus at least one data row.";
  }
  const header = lines[0];
  if (!header.includes(",") && !header.includes(";") && !header.includes("\t")) {
    return "Header row has no delimiter (comma, semicolon, or tab). Is this really a CSV?";
  }
  return null;
}

export default function App() {
  const [screen, setScreen] = useState(SCREEN_SETUP);
  const [apiKey, setApiKey] = useState("");
  const [csvString, setCsvString] = useState("");
  const [fileName, setFileName] = useState("");
  const [userContext, setUserContext] = useState({ ...DEFAULT_USER_CONTEXT });
  const [topLevelError, setTopLevelError] = useState("");

  const [statuses, setStatuses] = useState(emptyStatuses());
  const [methodologies, setMethodologies] = useState({});
  const [errors, setErrors] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Execution preference: when true, the three specialists run sequentially
  // instead of in parallel. Sacrifices wall-clock for reliability on TPM-limited
  // Anthropic accounts. Stored separately from userContext because it's an
  // orchestration choice, not a hint to the agents.
  const [sequentialSpecialists, setSequentialSpecialists] = useState(false);
  // Cancellation: each fresh analysis or reset creates a new AbortController so
  // in-flight requests from a prior run can be aborted before they corrupt state.
  const abortRef = useRef(null);
  const headingRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [specialistResults, setSpecialistResults] = useState({
    temporal: null,
    distributional: null,
    relational: null,
  });
  const [synthesis, setSynthesis] = useState(null);
  const [narrative, setNarrative] = useState(null);

  // Reflect the current screen in the document title so the browser tab is informative.
  useEffect(() => {
    const titles = {
      [SCREEN_SETUP]: "Anomaly Hunter",
      [SCREEN_PROCESSING]: "Analyzing… — Anomaly Hunter",
      [SCREEN_RESULTS]: "Findings — Anomaly Hunter",
      [SCREEN_EMPTY]: "No findings — Anomaly Hunter",
    };
    const next = titles[screen];
    if (next && document.title !== next) document.title = next;
  }, [screen]);

  // Move keyboard focus to the new screen's main heading so screen-reader and
  // keyboard users don't lose context across screen transitions.
  useEffect(() => {
    if (headingRef.current) {
      headingRef.current.focus({ preventScroll: false });
    }
  }, [screen]);

  function setStatus(key, value) {
    setStatuses((s) => ({ ...s, [key]: value }));
  }
  function setMethod(key, list) {
    setMethodologies((m) => ({ ...m, [key]: list }));
  }
  function setErr(key, value) {
    setErrors((e) => ({ ...e, [key]: value }));
  }

  function handleDataLoaded(text, name) {
    // Strip UTF-8 BOM here (single ingest point) so every downstream consumer
    // sees clean text, including the Inspector's column-name detection.
    const cleaned =
      typeof text === "string" && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text || "";
    setCsvString(cleaned);
    setFileName(name || "data.csv");
  }

  function clearData() {
    setCsvString("");
    setFileName("");
  }

  function resetForNewAnalysis() {
    // Abort any in-flight requests so they can't write into the new run's state.
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { /* no-op */ }
      abortRef.current = null;
    }
    setScreen(SCREEN_SETUP);
    setCsvString("");
    setFileName("");
    setUserContext({ ...DEFAULT_USER_CONTEXT });
    setStatuses(emptyStatuses());
    setMethodologies({});
    setErrors({});
    setProfile(null);
    setStrategy(null);
    setSpecialistResults({ temporal: null, distributional: null, relational: null });
    setSynthesis(null);
    setNarrative(null);
    setTopLevelError("");
    setIsAnalyzing(false); // crucial: would otherwise block the next Analyze click
  }

  // Returns the AbortSignal for the current analysis run, or undefined if no
  // controller exists yet (very early in a fresh run). All agent calls pass it
  // so that resetForNewAnalysis can abort everything atomically.
  function currentSignal() {
    return abortRef.current?.signal;
  }

  // Centralized catch-side handling: if the failure was a deliberate abort,
  // don't pollute the UI with a phantom "error" status — let the reset finish.
  function markAgentFailure(key, err) {
    if (isAbortError(err)) return;
    setStatus(key, "error");
    setErr(key, err.message || String(err));
  }

  async function runInspector() {
    setErr("inspector", undefined);
    setStatus("inspector", "running");
    try {
      const p = await inspector(csvString, userContext, apiKey, currentSignal());
      setProfile(p);
      setMethod("inspector", methodologiesFromInspector(p));
      setStatus("inspector", "complete");
      return p;
    } catch (err) {
      markAgentFailure("inspector", err);
      throw err;
    }
  }

  async function runOrchestrator(p) {
    setErr("orchestrator", undefined);
    setStatus("orchestrator", "running");
    try {
      const o = await orchestrator(p, userContext, apiKey, currentSignal());
      setStrategy(o);
      setMethod("orchestrator", methodologiesFromOrchestrator(o));
      setStatus("orchestrator", "complete");
      return o;
    } catch (err) {
      markAgentFailure("orchestrator", err);
      throw err;
    }
  }

  async function runSpecialists(p, o) {
    const activated = o?.activateAgents || [];
    const agentFns = {
      temporal: temporalAgent,
      distributional: distributionalAgent,
      relational: relationalAgent,
    };

    // Shared per-specialist call: writes its own result to state on success so
    // that retries of OTHER specialists never lose this one's output.
    const callSpecialist = async (key) => {
      setErr(key, undefined);
      setStatus(key, "running");
      try {
        const result = await agentFns[key](
          csvString,
          p,
          o.agentInstructions?.[key] || null,
          userContext,
          apiKey,
          currentSignal()
        );
        setMethod(key, result?.methodologiesUsed || []);
        setStatus(key, "complete");
        setSpecialistResults((prev) => ({ ...prev, [key]: result }));
        return [key, result];
      } catch (err) {
        markAgentFailure(key, err);
        throw err;
      }
    };

    const next = { temporal: null, distributional: null, relational: null };

    if (sequentialSpecialists) {
      // Sequential: each specialist completes before the next starts. Slower
      // overall but avoids parallel pressure on the account's TPM limit.
      // Keep going on errors (mirroring allSettled semantics) so the user can
      // retry only the failures without losing successful sibling results.
      let firstError = null;
      for (const key of activated) {
        try {
          const [k, result] = await callSpecialist(key);
          next[k] = result;
        } catch (err) {
          if (!firstError) firstError = err;
          // continue to the next specialist
        }
      }
      if (firstError) throw firstError;
      return next;
    }

    // Parallel: all three fire at once, results captured via Promise.allSettled
    // so a single failure doesn't drop the siblings' work.
    const settled = await Promise.allSettled(activated.map(callSpecialist));
    for (const s of settled) {
      if (s.status === "fulfilled") {
        const [key, result] = s.value;
        next[key] = result;
      }
    }
    const firstRejection = settled.find((s) => s.status === "rejected");
    if (firstRejection) {
      throw firstRejection.reason;
    }
    return next;
  }

  async function runSynthesis(specialists, p, o) {
    setErr("synthesis", undefined);
    setStatus("synthesis", "running");
    try {
      const s = await synthesisAgent(specialists, p, o, apiKey, currentSignal());
      setSynthesis(s);
      setMethod("synthesis", ["Triangulation", "Bayesian belief updating"]);
      setStatus("synthesis", "complete");
      return s;
    } catch (err) {
      markAgentFailure("synthesis", err);
      throw err;
    }
  }

  async function runNarrative(s, p, o) {
    setErr("narrative", undefined);
    setStatus("narrative", "running");
    try {
      const top5 = (s?.rankedAnomalies || []).slice(0, 5);
      const n = await narrativeAgent(top5, p, o, apiKey, currentSignal());
      setNarrative(n);
      setMethod("narrative", ["Minto Pyramid", "SCQA", "BLUF", "SMART"]);
      setStatus("narrative", "complete");
      return n;
    } catch (err) {
      markAgentFailure("narrative", err);
      throw err;
    }
  }

  async function startAnalysis() {
    if (isAnalyzing) return; // guard against rapid double-clicks
    const csvError = validateCsv(csvString);
    if (csvError) {
      setTopLevelError(csvError);
      return;
    }
    // Fresh AbortController per analysis run. Aborting one run's controller
    // never affects a subsequent run because we replace the ref here.
    abortRef.current = new AbortController();
    setIsAnalyzing(true);
    setScreen(SCREEN_PROCESSING);
    setStatuses(emptyStatuses());
    setMethodologies({});
    setErrors({});
    setTopLevelError("");

    try {
      const p = await runInspector();
      const o = await runOrchestrator(p);
      const specialists = await runSpecialists(p, o);
      const s = await runSynthesis(specialists, p, o);

      if (!s?.rankedAnomalies || s.rankedAnomalies.length === 0) {
        // Mark narrative as complete (with no work to do) so the per-agent
        // status row is consistent if anything ever surfaces it.
        setStatus("narrative", "complete");
        setScreen(SCREEN_EMPTY);
        return;
      }

      await runNarrative(s, p, o);
      setScreen(SCREEN_RESULTS);
    } catch (err) {
      if (isAbortError(err)) {
        // Run was deliberately aborted (user reset); swallow silently.
        return;
      }
      if (isAuthError(err)) {
        setTopLevelError(
          "Your Anthropic API key was rejected (401). Please correct it and try again."
        );
        setScreen(SCREEN_SETUP);
      } else if (isRateLimitError(err)) {
        setTopLevelError(
          "Anthropic rate-limited the request (429). Wait a minute, then click Retry on the failed agent — already-completed steps are preserved."
        );
      }
      // Otherwise leave the user on the processing screen so they can retry the failed agent.
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function retryAgent(key) {
    if (isAnalyzing) return; // a retry is already in flight (or initial analysis is running)
    // Fresh controller for the retry so it isn't aborted by the previous run's state.
    abortRef.current = new AbortController();
    setIsAnalyzing(true);
    try {
      if (key === "inspector") {
        const p = await runInspector();
        const o = await runOrchestrator(p);
        const specialists = await runSpecialists(p, o);
        const s = await runSynthesis(specialists, p, o);
        if (!s?.rankedAnomalies?.length) {
          setStatus("narrative", "complete");
          return setScreen(SCREEN_EMPTY);
        }
        await runNarrative(s, p, o);
        return setScreen(SCREEN_RESULTS);
      }
      if (key === "orchestrator") {
        const o = await runOrchestrator(profile);
        const specialists = await runSpecialists(profile, o);
        const s = await runSynthesis(specialists, profile, o);
        if (!s?.rankedAnomalies?.length) {
          setStatus("narrative", "complete");
          return setScreen(SCREEN_EMPTY);
        }
        await runNarrative(s, profile, o);
        return setScreen(SCREEN_RESULTS);
      }
      if (key === "temporal" || key === "distributional" || key === "relational") {
        setErr(key, undefined);
        setStatus(key, "running");
        const agentFn = {
          temporal: temporalAgent,
          distributional: distributionalAgent,
          relational: relationalAgent,
        }[key];
        let result;
        try {
          result = await agentFn(
            csvString,
            profile,
            strategy?.agentInstructions?.[key] || null,
            userContext,
            apiKey,
            currentSignal()
          );
        } catch (err) {
          markAgentFailure(key, err);
          throw err;
        }
        setMethod(key, result?.methodologiesUsed || []);
        setStatus(key, "complete");
        const nextSpecialists = { ...specialistResults, [key]: result };
        setSpecialistResults(nextSpecialists);

        const activated = strategy?.activateAgents || [];
        // All activated specialists are "done" when each one has a non-null result.
        const allDone = activated.every((k) => nextSpecialists[k] != null);
        if (allDone) {
          const s = await runSynthesis(nextSpecialists, profile, strategy);
          if (!s?.rankedAnomalies?.length) {
            setStatus("narrative", "complete");
            return setScreen(SCREEN_EMPTY);
          }
          await runNarrative(s, profile, strategy);
          setScreen(SCREEN_RESULTS);
        }
        return;
      }
      if (key === "synthesis") {
        const s = await runSynthesis(specialistResults, profile, strategy);
        if (!s?.rankedAnomalies?.length) {
          setStatus("narrative", "complete");
          return setScreen(SCREEN_EMPTY);
        }
        await runNarrative(s, profile, strategy);
        return setScreen(SCREEN_RESULTS);
      }
      if (key === "narrative") {
        await runNarrative(synthesis, profile, strategy);
        return setScreen(SCREEN_RESULTS);
      }
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }
      if (isAuthError(err)) {
        setTopLevelError(
          "Your Anthropic API key was rejected (401). Please correct it and try again."
        );
        setScreen(SCREEN_SETUP);
      } else if (isRateLimitError(err)) {
        setTopLevelError(
          "Anthropic rate-limited the request (429). Wait a minute, then click Retry on the failed agent."
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  }

  const canAnalyze = apiKey.trim().length > 0 && csvString.trim().length > 0;

  const banner = topLevelError ? (
    <div className="max-w-3xl mx-auto mt-4 mb-2 px-4">
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-200 px-4 py-3 text-sm"
      >
        {topLevelError}
      </div>
    </div>
  ) : null;

  if (screen === SCREEN_PROCESSING) {
    return (
      <>
        {banner}
        <AgentProgress
          headingRef={headingRef}
          statuses={statuses}
          methodologies={methodologies}
          errors={errors}
          onRetry={retryAgent}
          activatedSpecialists={strategy?.activateAgents}
          sequentialSpecialists={sequentialSpecialists}
        />
      </>
    );
  }

  if (screen === SCREEN_RESULTS) {
    return (
      <Results
        headingRef={headingRef}
        profile={profile}
        orchestratorOutput={strategy}
        synthesis={synthesis}
        narrative={narrative}
        onReset={resetForNewAnalysis}
      />
    );
  }

  if (screen === SCREEN_EMPTY) {
    return <EmptyState headingRef={headingRef} onReset={resetForNewAnalysis} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pb-16">
      <HeroSection headingRef={headingRef} />

      {topLevelError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-4 rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-200 px-4 py-3 text-sm"
        >
          {topLevelError}
        </div>
      )}

      <HowItWorksDiagram />
      <OutputPreview />

      <section className="mt-12">
        <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-4">Required inputs</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-5">
          <ApiKeyInput value={apiKey} onChange={setApiKey} />
          <FileUpload onLoaded={handleDataLoaded} fileName={fileName} onClear={clearData} />
          <div className="text-xs text-slate-500">— or —</div>
          <SampleDataButton onUse={handleDataLoaded} />
        </div>
      </section>

      <section className="mt-8">
        <OptionalContextPanel
          value={userContext}
          onChange={setUserContext}
          sequentialSpecialists={sequentialSpecialists}
          onSequentialChange={setSequentialSpecialists}
        />
      </section>

      <section className="mt-10 text-center">
        <button
          type="button"
          disabled={!canAnalyze || isAnalyzing}
          onClick={startAnalysis}
          className={`rounded-md px-6 py-3 text-base font-semibold transition ${
            canAnalyze && !isAnalyzing
              ? "bg-indigo-500 text-white hover:bg-indigo-400"
              : "bg-slate-800 text-slate-500 cursor-not-allowed"
          }`}
        >
          {isAnalyzing ? "Analyzing…" : "Analyze"}
        </button>
        <p className="mt-3 text-xs text-slate-500">Analysis typically takes 20–40 seconds.</p>
      </section>
    </div>
  );
}
