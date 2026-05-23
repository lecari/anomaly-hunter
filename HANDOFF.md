# Anomaly Hunter — Handoff Document

A single source of truth for picking up this project in a fresh context.
Working directory: `/Users/lucaecari/Desktop/anomaly-hunter`.

---

## 1. What this is

A browser-only React/Vite SPA that runs anomaly detection on any tabular CSV
through a coordinated team of 7 Claude agents. Everything runs in the user's
browser; the Anthropic API key is user-supplied, held in memory only, and
goes directly from the browser to `api.anthropic.com` via the official SDK
with `dangerouslyAllowBrowser: true`.

The product is **domain-agnostic**: it works equally on personal finance,
sales, sensor logs, HR data — anything tabular. The system autonomously
profiles the data, picks the right specialists, runs them in parallel,
synthesizes their findings, and writes an audience-adapted narrative.

---

## 2. Current state

**Status: working end-to-end, validated against the sample dataset.**

- Dev server: `npm run dev` → http://localhost:5173/
- Production build: `npm run build` (≈448 KB pre-gzip / 128 KB gzip, 144 modules)
- Lint: `npm run lint` (clean)
- `npm audit`: 0 vulnerabilities
- Unit tests: `node scripts/testSafeJson.mjs` (utils edge cases)
- Pipeline sim:  `node scripts/testPipeline.mjs` (sample data flow checks)

The most recent end-to-end run with the sample data completed successfully:
Inspector → Orchestrator → 3 specialists in parallel → Synthesis (≈3 min) →
Narrative → Results. The user verified the embedded anomalies are detected
(restaurant acceleration, shopping share shift, grocery frequency anomaly,
August dental outlier).

---

## 3. Tech stack

- React 19 + Vite 8 (JavaScript, NOT TypeScript by spec)
- Tailwind CSS v3
- `@anthropic-ai/sdk` ^0.98 with `dangerouslyAllowBrowser: true`
- `papaparse` is installed but currently **unused** (kept as dependency for
  future use; CSV is passed verbatim to the model)
- Model: `claude-sonnet-4-6` (constant in `src/agents/utils.js`)

---

## 4. Multi-agent architecture (the 7 calls)

```
                          ┌──────────────────────────────┐
   CSV + user context ──▶ │ 1. Inspector                 │  Tukey EDA · DAMA · ISO/IEC 25012
                          │   data profile               │  6144 tokens
                          └──────────────┬───────────────┘
                                         ▼
                          ┌──────────────────────────────┐
                          │ 2. Orchestrator              │  CRISP-DM
                          │   strategy + activations     │  6144 tokens
                          └──┬───────────┬────────────┬──┘
                             │           │            │      Promise.allSettled
                             ▼           ▼            ▼
                     ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
                     │ 3. Temporal │ │ 4. Distribut.│ │ 5. Relational│
                     │ STL/PELT/   │ │ KS/PSI/JS/   │ │ Pearson/MI/  │   8192 each
                     │ Mann-K/MP/  │ │ Wasserstein/ │ │ LOF/Mahal./  │
                     │ drift       │ │ Pareto/Gini  │ │ DBSCAN       │
                     └──────┬──────┘ └──────┬───────┘ └──────┬───────┘
                            └──────────┬───┴──────────────┘
                                       ▼
                          ┌──────────────────────────────┐
                          │ 6. Synthesis                 │  Triangulation + Bayesian
                          │   ranked anomalies           │  16384 tokens
                          └──────────────┬───────────────┘
                                         ▼ (top 5 → narrative; all → UI)
                          ┌──────────────────────────────┐
                          │ 7. Narrative                 │  Minto / SCQA / BLUF / SMART
                          │ exec summary + keyTakeaways  │  8192 tokens
                          │ + per-anomaly prose          │
                          └──────────────────────────────┘
```

### Activation rules (Orchestrator, applied mechanically against Inspector profile)
- **Temporal** if any column has `inferredRole: "temporal"`
- **Distributional** if any categorical column OR ≥2 numeric_measure columns
- **Relational** if (numeric_measure + categorical) ≥ 2 AND totalRows > 50

The Orchestrator never skips a specialist whose rule fires. User objective only
*weights* methods within each activated specialist; it never decides activation.

---

## 5. Discovery Principle (core philosophy)

User-provided context (domain hint, analytical objective, notes, audience) is a
**prior, never a filter**.

- Inspector profiles every column, regardless of any hint
- Orchestrator activates every specialist whose data-driven rule fires,
  regardless of objective
- Specialists apply **both** prioritized methods (objective-aligned) AND a
  mandatory broader scan (everything else in their toolkit)
- Each anomaly is tagged `discoveryType: "aligned" | "unexpected" | "general"`
- Synthesis weights unexpected discoveries higher (they're what the user
  couldn't have anticipated)
- Narrative surfaces unexpected discoveries with explicit framing
  ("Beyond your focus area:", "A pattern you did not ask about:")

> **The real value is surfacing what the user did not know to look for.**

---

## 6. Significance model — honest disclosure with materiality

The biggest design decision in the current architecture: **specialists never
return empty results, but they are obligated to be honest about confidence.**

Every anomaly carries two graduated dimensions:

### `significance` (categorical — recommended action level)
- `"investigate"` — clear, robust pattern; deep follow-up warranted; confidence ≥ 0.70
- `"monitor"` — moderate pattern; worth tracking over time; confidence 0.40–0.69
- `"noted"` — weak/marginal pattern OR a method the specialist ran without finding much; confidence < 0.40

### `confidence` (numeric, 0–1) — quantitative reliability of the signal

### Rules enforced in specialist prompts
1. **Minimum 3 findings** per specialist scan. If the data is genuinely
   unremarkable in that domain, emit `"noted"` entries describing
   *which methods were applied* and *what residual signal was observed* — these
   are not failures, they are part of a complete scan.
2. **No fabrication.** Do not invent patterns.
3. **No promotion to fill a quota.** Do not promote `noted` findings to
   `investigate` to look impressive.
4. **No suppression.** Do not omit weak signals to look clean. The user
   decides what to pursue; filtering is their job.
5. **Brevity:** evidence ≤ 3 sentences, userExplanationAssessment ≤ 1
   sentence or null, titles ≤ 12 words.

### Synthesis severity tiers (mapped from significance + context)
- **HIGH** — detected by 2+ specialists (convergent), OR a contradiction, OR
  significance:investigate with impact > 15% or high-impact unexpected
- **MEDIUM** — significance:investigate with 5–15% impact, OR
  significance:monitor with impact > 10%, OR a notable unexpected discovery
- **LOW** — significance:monitor, OR significance:investigate with impact < 5%
- **NOTE** — significance:noted (recorded for awareness, not action)

Convergence between specialists elevates a finding to HIGH **regardless** of
individual significance — independent confirmation is the strongest signal.

### How this surfaces in the UI
- **Top-5** findings get full narrative cards with labeled sections
- **Rank 6+** findings get compact expandable rows in an "Also detected" section
- **ExecutiveSummary** shows significance counts as colored chips:
  `N investigate · N monitor · N noted` plus an `N unexpected` chip
- Findings are sorted: severity desc → impact desc → unexpected before aligned

This is the architectural answer to the user's mandate: *agents never fail to
produce findings, but they are honest about which ones are worth investigating
versus which ones are merely noted*.

---

## 7. Token budgets (current, all in `src/agents/`)

| Agent | `max_tokens` | Rationale |
| --- | :-: | --- |
| Inspector | **16384** | Per-column stats × N columns; wide CSVs (30+ cols) need significant headroom |
| Orchestrator | 6144 | Strategy + 3 sets of {focus, prioritized, broaderScan, considerations} |
| Temporal | 8192 | ≥3 anomalies × 14 rich fields each |
| Distributional | 8192 | Same |
| Relational | 8192 | Same |
| Synthesis | **16384** | Preserves ALL specialist findings (9+ entries) verbatim with extra metadata + synthesisNotes prose |
| Narrative | 8192 | Top-5 prose + 5 keyTakeaways + exec summary |

**Request timeout:** `REQUEST_TIMEOUT_MS = 600000` (10 minutes) in
`src/agents/utils.js`. Matches the SDK default. With 3 parallel specialists at
8192 max_tokens each, the user's account can hit TPM limits and the SDK retries
internally with backoff — that eats into the timeout, so we use the most
permissive ceiling. A true hang still gets cut off.

**If specialists time out:** click Retry on each failed one *one at a time* —
serializing manually avoids the parallel TPM pressure.

---

## 8. UX structure

### Screen 1 — Setup (single scrollable page)
- Hero + value paragraph
- "How it works" horizontal diagram (5 stages, stacks vertically on mobile)
- "What you'll get" mockup
- Required inputs: Anthropic API key (password input with show/hide,
  `aria-pressed` toggle, privacy note) + CSV file upload (drag-drop with
  keyboard support: `role="button"`, `tabIndex={0}`, Enter/Space activates) OR
  "Try with sample data" button
- Collapsible "Help the agents (optional)" panel:
  - Domain hint (Auto-detect default, or pick from 9 + Other)
  - What you want to find (5 objectives + General exploration default)
  - Notes (500 char textarea)
  - Report audience (General/Executive/Technical)
  - Execution mode: "Run specialists one at a time" checkbox (default off).
    When on, the 3 specialists run sequentially instead of in parallel — slower
    wall-clock, no parallel TPM pressure. Useful for low-tier Anthropic accounts.
- "Analyze" button, disabled until apiKey AND CSV are present;
  client-side `validateCsv` runs first (rejects empty, header-only, no-delim,
  binary file via control-char probe)

### Screen 2 — Processing
- 7 agent rows with status icons (waiting / running / complete / error / skipped)
- Specialists 3–5 grouped under "Running in parallel"
- Per-agent expandable "Methods" panel after completion
- Per-agent Retry button on error (creates new AbortController; doesn't pollute
  state if abort was deliberate)
- ARIA live region announces status changes for screen readers
- Top-level banner (`role="alert"`) for 401 / 429 / CSV-validation messages

### Screen 3 — Results
- **DatasetProfileCard**: domain (+ confidence chip), rows × cols, value unit,
  time period, hint-match indicator. **Data quality** with:
  - Per-dimension blurb (completeness/consistency/validity/uniqueness)
  - Interpretation chip (Excellent ≥90 / Good ≥75 / Acceptable ≥60 / Needs attention <60)
  - "How to read" footer line with thresholds
- **ExecutiveSummary**: BLUF prose (2–4 sentences) + significance-count chips +
  **Key takeaways at a glance** — one entry per top-5 finding, each with a
  3-column grid: *Why it matters · Impact for you · Suggested action*
- **Detailed findings** section, with:
  - Collapsible **"How to read these findings" legend** explaining every
    badge (severity, significance, confidence %, discovery framing, convergence)
  - 5 anomaly cards with labeled sections:
    1. *What was detected* — narrative `what` + collapsible "Show raw evidence"
    2. *Why this matters* — narrative `whyItMatters`
    3. *Impact for you* (amber accent) — synthesis `impactDescription`
    4. *Recommended action* (indigo accent) — narrative `whatToDo`
    5. Footer: "Detected via {agent chips}" + convergence indicator
  - Each badge has a native `title` tooltip with its definition
- **Also detected — for awareness** (only if synthesis returned > 5):
  compact expandable rows for findings 6+
- **Synthesis notes** at bottom (prose from synthesis)

### Screen 4 — EmptyState (rare; only if synthesis returned 0 rankedAnomalies)
With the "always emit ≥3 findings" rule, this is essentially unreachable on
non-trivial data. Wording reflects that.

---

## 9. Robustness layer

### `src/agents/utils.js` exports (every agent uses these)
- `safeJsonParse(text)` — strips ``` fences, slices `{`…`}`, parses, throws
  with `cause` on failure
- `truncateCsv(csv, maxChars)` — strips BOM, truncates at last newline before
  cap (50% floor so wide rows aren't lost), appends marker
- `countCsvRows(csv)` — **RFC 4180 quote-aware**: newlines inside quoted fields
  don't count
- `stripBom(csv)` — removes leading U+FEFF
- `buildUserContextBlock(ctx)` — drops null/empty fields so the model isn't
  told `"domainHint": null` as if it were a deliberate value
- `extractAgentText(response, label)` — checks `response.stop_reason ===
  "max_tokens"` and throws a user-friendly message; otherwise returns joined
  text content
- `isAbortError(err)` — distinguishes deliberate abort from real failures
- `REQUEST_TIMEOUT_MS` and `MODEL_ID` constants

### Post-parse enum normalization
LLMs occasionally drift on enum casing. Synthesis severity / significance /
discoveryType / convergenceType are normalized after parsing via
`normalizeSynthesisAnomalies`. Same for specialist output via
`normalizeSpecialistAnomalies` (includes `inferSignificanceFromConfidence`
fallback when the model forgets the significance field). This prevents silent
UI degradation (e.g., "high" instead of "HIGH" → no longer falls back to
NOTE styling).

### Concurrency
- **Default**: specialists run via `Promise.allSettled` (NOT `Promise.all`),
  and each writes its own result to React state via functional
  `setSpecialistResults((prev) => ({...prev, [key]: result}))` on success.
  This means if one specialist fails, the others' results are preserved and
  Retry can resume the pipeline.
- **Sequential opt-in**: the "Run specialists one at a time" checkbox in the
  optional context panel switches `runSpecialists` to a for-of loop that
  awaits each specialist in turn (continue-on-error so successes are still
  preserved). Mirrors `Promise.allSettled` semantics in serial form. Useful
  for Anthropic accounts that hit TPM limits with 3 parallel calls.
- `AbortController` stored in `useRef`. New controller per `startAnalysis` /
  `retryAgent`. `resetForNewAnalysis` aborts the current one.
- `isAnalyzing` boolean guards double-clicks on both Analyze and Retry.
- `markAgentFailure(key, err)` helper suppresses state updates when the error
  is an AbortError — keeps the UI clean during deliberate resets.

### Prompt caching
- Every agent's `system` field is sent as a block array with
  `cache_control: { type: "ephemeral" }`, so the (stable) system prompt is
  cached for ~5 minutes by Anthropic. Subsequent calls in the same session
  pay ~10% of the system-prompt input on hits (vs the ~25% write premium
  on the first call). Net win for retries and back-to-back analyses.
- The pattern (`src/agents/*.js`):
  ```js
  system: [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }
  ]
  ```
- This is now a mandated convention in `CLAUDE.md`.

### Error boundary
`src/components/ErrorBoundary.jsx` wraps `<App />` in `main.jsx`. Catches
render-time crashes from malformed LLM output and shows a "Something went
wrong / Reload page" fallback instead of a blank screen.

### Accessibility
- All form inputs have explicit `<label htmlFor>` ↔ `id` pairs
- All buttons have `type="button"`
- `aria-pressed` on the API-key show/hide toggle
- `aria-expanded` + `aria-controls` on every collapsible
- `role="status" aria-live="polite"` on agent progress
- `role="alert" aria-live="assertive"` on error banners
- `aria-label` per agent row reflecting its current status
- `aria-hidden="true"` on every decorative emoji (💡 🕒 📊 🔗 🪶 ▾ → ↓)
- Focus management: `useEffect` on screen change focuses the heading via
  `headingRef` (each screen component accepts the ref + uses `tabIndex={-1}`)
- `@media (prefers-reduced-motion: reduce)` disables `.pulse-dot` and forces
  near-zero transitions
- `@media print` whites the background for printer-friendly output
- `document.title` updates per screen (Setup / Analyzing… / Findings / No findings)

---

## 10. File map

```
src/
├── main.jsx                          ErrorBoundary > StrictMode > App
├── App.jsx                           4-screen state machine, all 7 agent calls,
│                                       AbortController, isAnalyzing guard,
│                                       validateCsv, BOM strip at ingest,
│                                       isAuthError / isRateLimitError / isAbortError
├── index.css                         Tailwind directives, pulse-dot,
│                                       reduced-motion + print media queries
├── agents/
│   ├── utils.js                      MODEL_ID, REQUEST_TIMEOUT_MS,
│                                       safeJsonParse, truncateCsv, countCsvRows,
│                                       stripBom, buildUserContextBlock,
│                                       extractAgentText, isAbortError,
│                                       normalize{Severity,Significance,
│                                       DiscoveryType,Convergence,AnomalyType},
│                                       normalize{Specialist,Synthesis}Anomalies,
│                                       inferSignificanceFromConfidence
│   ├── inspector.js                  6144 tokens; emits dataOverview + columns +
│                                       dataQualityIssues + potentialRelationships
│   ├── orchestrator.js               6144 tokens; activation rules + per-agent
│                                       instructions {focus, prioritized,
│                                       broaderScan, considerations}
│   ├── temporalAgent.js              8192 tokens; STL/PELT/Mann-K/Matrix Profile
│   ├── distributionalAgent.js        8192 tokens; KS/PSI/JS/Wasserstein/Gini
│   ├── relationalAgent.js            8192 tokens; Pearson/MI/LOF/Mahal./DBSCAN
│   ├── synthesisAgent.js             16384 tokens; severity rules + sort + counts
│   └── narrativeAgent.js             8192 tokens; executiveSummary +
│                                       keyTakeaways[] + anomalies[]
├── components/
│   ├── ErrorBoundary.jsx             Top-level render safety net
│   ├── HeroSection.jsx               h1 with headingRef
│   ├── HowItWorksDiagram.jsx         5-stage flow (stacks on mobile, ↓ vs →)
│   ├── OutputPreview.jsx             Setup-screen mockup of the 4-tier output
│   ├── ApiKeyInput.jsx               Password input + show/hide toggle
│   ├── FileUpload.jsx                Drag-drop + click-to-browse; keyboard accessible
│   ├── SampleDataButton.jsx          Loads embedded sample CSV
│   ├── OptionalContextPanel.jsx      4 form controls + "Other" textfield
│   ├── AgentProgress.jsx             ARIA live region; specialists grouped
│   ├── AgentProgressRow.jsx          Per-agent status; Retry; Methods expander
│   ├── DatasetProfileCard.jsx        Domain + confidence + data quality grid
│   │                                   with interpretation labels
│   ├── ExecutiveSummary.jsx          BLUF + keyTakeaways grid
│   ├── FindingsLegend.jsx            Collapsible legend for badges
│   ├── AnomalyCard.jsx               Top-5 cards with labeled sections
│   ├── CompactAnomalyRow.jsx         Rank 6+ expandable rows
│   ├── Results.jsx                   Composes the results screen
│   └── EmptyState.jsx                Rare; safety net
└── data/
    └── sampleData.js                 Auto-generated CHF 2024 transactions (~24 KB)
scripts/
├── generateSample.cjs                Deterministic seeded generator
├── testSafeJson.mjs                  ~40 unit tests on utils
└── testPipeline.mjs                  16 e2e simulation checks on sample data
README.md                             User-facing project doc
HANDOFF.md                            This file
```

---

## 11. Sample dataset

Generated deterministically by `scripts/generateSample.cjs` (Mulberry32 seeded
PRNG, seed `20240117`).

- 628 transactions across calendar year 2024 in CHF
- Columns: `date, amount, category, description`
- Categories: Groceries, Housing, Transport, Restaurants, Entertainment,
  Health, Shopping, Travel

### Four embedded anomalies the system should detect
1. **Restaurant acceleration** — Jan ~5 tx × ~40 → Dec ~10 tx × ~65 (~+160% total)
2. **Shopping share shift** — Jan–Jun ~8% of monthly total → Jul–Dec ~16%
3. **Grocery frequency anomaly** — Oct–Nov total stays ~500 but transaction
   count doubles (~7 → ~14), average halves
4. **Health outlier** — single August transaction of 1850 ("Dental procedure")
   vs typical monthly Health total ~180

If you regenerate the sample, run `node scripts/testPipeline.mjs` to confirm
the patterns are still present.

---

## 12. Privacy & cost notes

- API key is held in React state only. Never written to localStorage,
  sessionStorage, cookies, or any backend. Refreshing the page clears it.
- A full analysis on the sample CSV costs ≈0.10–0.30 USD on Sonnet 4.6
  (7 calls; most spend is the synthesis with its 16384 token ceiling).
- The synthesis is the slowest step (often 2–3 minutes); specialists in
  parallel run faster individually but can hit TPM limits and stall.
- No telemetry, no analytics, no third-party scripts.

---

## 13. Known limitations / deliberate non-goals

- **No CSV streaming** — full file is held in memory; truncated to ≤60 KB for
  Inspector / ≤50 KB for specialists. For multi-MB files, the agents see only
  the beginning of the dataset (their `totalRows` ground truth comes from a
  separate `countCsvRows` count of the full file).
- **No persistent API key** — by design.
- **No i18n** — UI is English-only; the model writes in English. Italian
  user context notes work fine but the report is still English.
- **No streaming responses** — each agent call is a full request/response.
  The user stares at a "running" spinner during long generations.
- **No cost estimate shown in UI** — could be added (Anthropic API returns
  usage in `response.usage`).
- **`@anthropic-ai/sdk` is browser-bundled** — Vite externalizes Node-only
  modules at build time; warnings during build are harmless.
- **No automated tests for React components** — only utils + pipeline sim.
  Visual testing is manual.
- **Safari ≤14.0 not officially tested** — modern Safari (≥14.1, all current
  iOS/macOS releases) works; older versions may have CSS `gap` quirks.

---

## 14. Where to look for what (quick reference)

| Question | File / Symbol |
| --- | --- |
| How is the 7-agent flow wired? | `src/App.jsx` — `runInspector`, `runOrchestrator`, `runSpecialists`, `runSynthesis`, `runNarrative`, `startAnalysis`, `retryAgent` |
| Where is each agent's system prompt? | `src/agents/<name>.js` top-level `SYSTEM_PROMPT` |
| Where are token budgets set? | Each agent's `client.messages.create({ max_tokens })` call. Timeout in `src/agents/utils.js` |
| How does the UI handle 4 severity tiers? | `SEVERITY_STYLES` maps in `AnomalyCard.jsx` and `CompactAnomalyRow.jsx`, fallback to `NOTE` |
| Significance / confidence mapping? | `inferSignificanceFromConfidence` in `src/agents/utils.js` |
| Why does Synthesis preserve all specialist findings? | Completeness rule in the synthesis system prompt; UI splits topFive + rest |
| How are unexpected discoveries surfaced? | Narrative prompt + `ExecutiveSummary` chip + `AnomalyCard` `discoveryBadge` |
| What stops the user from double-clicking Analyze? | `isAnalyzing` state in `App.jsx`; same guard on Retry |
| How is cancellation wired? | `abortRef` useRef + `currentSignal()` helper + per-agent `signal` parameter |
| What if the LLM returns malformed JSON? | `safeJsonParse` cleans + throws; `markAgentFailure` shows it on the row; ErrorBoundary catches render crashes |
| How do I bump max_tokens or change the model? | `src/agents/utils.js` (model + timeout) + per-agent `max_tokens` literal |
| Where is the sample data anomaly list documented? | Section 11 above + comments in `scripts/generateSample.cjs` |

---

## 15. Suggested next steps (none blocking)

In rough priority order if continued work is requested:

1. **Surface token cost** — read `response.usage.input_tokens` /
   `output_tokens` / `cache_read_input_tokens` from each agent call, sum,
   show estimated USD next to the results page (would also let users see
   the prompt-cache savings on retries).
2. **Streaming** — switch to `client.messages.stream()` so the UI can show
   incremental progress instead of a long opaque wait.
3. **Persist API key behind explicit opt-in** — currently in-memory only;
   add a "Remember on this device" checkbox that writes to `sessionStorage`
   with a clear warning.
4. **Component tests** — Vitest + React Testing Library for `AnomalyCard`,
   `Results`, `OptionalContextPanel`, focus management.
5. **CSV preview before Analyze** — show the first 5 rows after upload so the
   user can confirm the right file is loaded.
6. **Re-export findings** — JSON / CSV / PDF download of the results page.
7. **i18n** — pass user's `navigator.language` into the narrative prompt so
   the report comes back in the user's language.
8. **Tighten Safari support** — explicit test pass on Safari 14–17.

None of these are blockers for current use.

---

## 16. How to resume from a fresh chat

1. Read this file end-to-end.
2. `cd /Users/lucaecari/Desktop/anomaly-hunter && npm install && npm run dev`
3. Open `http://localhost:5173/`, paste an Anthropic API key, click
   "Try with sample data", click "Analyze". A full run takes ≈3–5 minutes
   wall-clock (synthesis is the slow leg).
4. If anything fails: check `npm run lint`, then
   `node scripts/testSafeJson.mjs`, then `node scripts/testPipeline.mjs`.
5. The agent system prompts in `src/agents/<name>.js` are the source of truth
   for behavior. The UI lives in `src/components/`. State machine lives in
   `src/App.jsx`. Cross-cutting helpers in `src/agents/utils.js`.

That's everything.
